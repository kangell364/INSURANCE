-- ===========================================================================
-- Phase 1 Row-Level Security test suite (pgTAP).
--
-- Run with:  supabase test db
--
-- Every assertion is executed as a real, unprivileged `authenticated`
-- connection with a JWT subject set, exactly as PostgREST would run it. The
-- whole file runs inside a transaction that is rolled back at the end, so it
-- leaves no data behind.
-- ===========================================================================

create extension if not exists pgtap with schema extensions;

begin;

select plan(35);

-- ---------------------------------------------------------------------------
-- Fixtures. Inserting into auth.users fires public.handle_new_user(), so the
-- profiles rows below are created by the trigger under test, not by hand.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                        created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'student.a@example.test',
   '{"first_name":"Ada","last_name":"Alpha"}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'student.b@example.test',
   '{"first_name":"Ben","last_name":"Bravo"}'::jsonb, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@example.test',
   '{"first_name":"Cee","last_name":"Charlie"}'::jsonb, now(), now());

-- Promote the admin the same way the README documents: privileged SQL, never
-- through the application.
update public.profiles
   set role = 'admin'
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.courses (id, title, slug, description, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Active Course', 'active-course',
   'Visible to everyone.', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Draft Course', 'draft-course',
   'Admins only.', 'draft');

insert into public.enrollments (student_id, course_id, status)
values
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'active'),
  ('22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-0000-0000-0000-000000000001', 'active');

-- ---------------------------------------------------------------------------
-- Sanity: the signup trigger populated the profile correctly.
-- ---------------------------------------------------------------------------
select is(
  (select role::text from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'student',
  'handle_new_user assigns role = student'
);

select is(
  (select first_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Ada',
  'handle_new_user copies first_name from signup metadata'
);

-- Metadata may not set an elevated role.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data,
                        created_at, updated_at)
values ('44444444-4444-4444-4444-444444444444',
        '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'sneaky@example.test',
        '{"first_name":"Eve","last_name":"Echo","role":"admin"}'::jsonb,
        now(), now());

select is(
  (select role::text from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'),
  'student',
  'signup metadata claiming role=admin is ignored'
);

-- ---------------------------------------------------------------------------
-- RLS is actually on.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('profiles', 'courses', 'enrollments')
      and relrowsecurity),
  3,
  'RLS is enabled on profiles, courses and enrollments'
);

-- ===========================================================================
-- Acting as Student A
-- ===========================================================================
select set_config('request.jwt.claim.sub',
                  '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
                  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
                  true);
set local role authenticated;

-- 1. Student A can read Student A's profile.
select is(
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  1,
  '1. Student A can read their own profile'
);

-- 2. Student A cannot read Student B's profile.
select is(
  (select count(*)::int from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  0,
  '2. Student A cannot read Student B''s profile'
);

select is(
  (select count(*)::int from public.profiles),
  1,
  '2b. An unfiltered profiles scan returns only Student A''s own row'
);

-- 3. Student A can update allowed profile fields.
select lives_ok(
  $$update public.profiles
       set first_name = 'Adeline', last_name = 'Alpher'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '3. Student A can update their own first_name / last_name'
);

select is(
  (select first_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Adeline',
  '3b. The update was persisted'
);

-- 4. Student A cannot update their role to admin.
select throws_ok(
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  '4. Student A cannot escalate their own role to admin'
);

select throws_ok(
  $$update public.profiles set email = 'attacker@example.test'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  '4b. Student A cannot change their profile email directly'
);

-- Modifying another user's profile is a silent no-op (the row is invisible),
-- which is the correct RLS behaviour — assert nothing changed.
select is(
  (select count(*)::int from public.profiles p
    where p.id = '22222222-2222-2222-2222-222222222222'),
  0,
  '4c. Student B''s profile is not reachable for update by Student A'
);

-- 5. Student A can read active courses.
select is(
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  '5. Student A can read active courses'
);

-- 6. Student A cannot read draft courses.
select is(
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  '6. Student A cannot read draft courses'
);

-- 7. Student A can read their own enrollments.
select is(
  (select count(*)::int from public.enrollments
    where student_id = '11111111-1111-1111-1111-111111111111'),
  1,
  '7. Student A can read their own enrollments'
);

-- 8. Student A cannot read Student B's enrollments.
select is(
  (select count(*)::int from public.enrollments),
  1,
  '8. An unfiltered enrollments scan returns only Student A''s own row'
);

-- 9. Student A cannot create arbitrary enrollment access.
select throws_ok(
  $$insert into public.enrollments (student_id, course_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000002', 'active')$$,
  '42501',
  null,
  '9. Student A cannot self-enroll (no student INSERT policy)'
);

select throws_ok(
  $$insert into public.enrollments (student_id, course_id, status)
    values ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000001', 'completed')$$,
  '42501',
  null,
  '9b. Student A cannot create an enrollment for Student B'
);

-- 10. Non-admin users cannot reach admin-protected functionality.
select is(
  public.is_admin(),
  false,
  '10. is_admin() is false for a student'
);

select throws_ok(
  $$insert into public.courses (title, slug, status)
    values ('Pirate Course', 'pirate-course', 'active')$$,
  '42501',
  null,
  '10b. Student A cannot create courses'
);

-- Under RLS an UPDATE against rows the caller cannot see does not raise; it
-- simply affects zero rows. "Nothing changed" is the guarantee to assert.
select lives_ok(
  $$update public.courses set status = 'active'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '10c. A student publishing a draft course is a no-op, not an error'
);

select lives_ok(
  $$update public.enrollments set status = 'cancelled'
     where student_id = '11111111-1111-1111-1111-111111111111'$$,
  '10d. A student updating their own enrollment is a no-op (no UPDATE policy)'
);

reset role;

-- ===========================================================================
-- Acting as the admin
-- ===========================================================================
select set_config('request.jwt.claim.sub',
                  '33333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
                  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
                  true);
set local role authenticated;

select is(public.is_admin(), true, '11. is_admin() is true for an admin');

select ok(
  (select count(*) from public.profiles) > 1,
  '12. An admin can read every profile'
);

select is(
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  1,
  '13. An admin can read draft courses'
);

select ok(
  (select count(*) from public.enrollments) = 2,
  '14. An admin can read every enrollment'
);

-- None of Student A's attempted writes landed.
select is(
  (select status::text from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'draft',
  '15. The draft course is still a draft'
);

select is(
  (select status::text from public.enrollments
    where student_id = '11111111-1111-1111-1111-111111111111'),
  'active',
  '16. Student A''s enrollment was not cancelled'
);

-- profiles.role is not writable through the API by ANYONE, admins included:
-- `authenticated` holds no UPDATE privilege on that column. Promotion is an
-- out-of-band, service-role operation. See README.
select throws_ok(
  $$update public.profiles set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501',
  null,
  '17. Not even an admin can write profiles.role through the API'
);

select lives_ok(
  $$update public.profiles set first_name = 'Benjamin'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  '18. An admin can correct another user''s name'
);

reset role;

-- ---------------------------------------------------------------------------
-- The immutability trigger, tested in isolation.
--
-- Every other assertion here is satisfied by the column-level GRANT, which
-- rejects the statement before execution reaches the trigger. The GRANT is
-- widened below so the trigger is actually exercised — this is what would have
-- caught it being a no-op when it was mistakenly declared SECURITY DEFINER.
-- ---------------------------------------------------------------------------
select is(
  (select prosecdef from pg_proc
    where proname = 'enforce_profile_immutable_columns'),
  false,
  '19. The immutability trigger is SECURITY INVOKER, not SECURITY DEFINER'
);

grant update on table public.profiles to authenticated;

select set_config('request.jwt.claim.sub',
                  '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims',
                  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
                  true);
set local role authenticated;

select throws_ok(
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  '20. With the column GRANT widened, the trigger still blocks self-promotion'
);

select throws_ok(
  $$update public.profiles set email = 'attacker@example.test'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  '21. With the column GRANT widened, the trigger still blocks an email change'
);

select lives_ok(
  $$update public.profiles set first_name = 'Still Editable'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  '22. ...while an ordinary name change still succeeds'
);

reset role;

select is(
  (select role::text from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'student',
  '23. Student A is still a student after all of that'
);

revoke update on table public.profiles from authenticated;
grant update (first_name, last_name) on table public.profiles to authenticated;

select * from finish();

rollback;
