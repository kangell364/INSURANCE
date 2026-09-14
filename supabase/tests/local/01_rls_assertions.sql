-- ===========================================================================
-- Phase 1 RLS assertions — plain SQL, no pgTAP required.
--
-- Mirrors supabase/tests/rls_phase1_test.sql one-for-one so that the same
-- security guarantees are verified whether or not Docker is available.
--
-- Run via scripts/test-rls-local.sh. Any failed assertion raises and aborts
-- the script with a non-zero exit status.
-- ===========================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Assertion helpers. Created inside the transaction; rolled back at the end.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.check_eq(
  label text, actual anyelement, expected anyelement
) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL  %  (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok    %', label;
end;
$$;

-- Asserts the statement is rejected with a specific SQLSTATE.
create or replace function pg_temp.check_error(
  label text, stmt text, expected_sqlstate text
) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception
    when others then
      if sqlstate = expected_sqlstate then
        raise notice 'ok    % (rejected %: %)', label, sqlstate, sqlerrm;
        return;
      end if;
      raise exception 'FAIL  %  (expected %, got % - %)',
        label, expected_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL  %  (statement unexpectedly SUCCEEDED)', label;
end;
$$;

-- Asserts the statement is rejected with SQLSTATE 42501 (insufficient
-- privilege) — which covers both "permission denied for table" from the
-- column-level GRANTs and "new row violates row-level security policy".
create or replace function pg_temp.check_denied(
  label text, stmt text
) returns void language plpgsql as $$
begin
  perform pg_temp.check_error(label, stmt, '42501');
end;
$$;

create or replace function pg_temp.check_ok(
  label text, stmt text
) returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok    %', label;
end;
$$;

-- Asserts how many rows a statement actually touched.
--
-- This is the correct assertion for UPDATE/DELETE under RLS: rows that fail a
-- policy's USING clause are filtered out of the statement rather than raising,
-- so an unauthorised UPDATE succeeds while affecting zero rows. "Zero rows
-- changed" is the security guarantee; an error is not required.
create or replace function pg_temp.check_affects(
  label text, stmt text, expected_rows int
) returns void language plpgsql as $$
declare
  affected int;
begin
  execute stmt;
  get diagnostics affected = row_count;
  if affected <> expected_rows then
    raise exception 'FAIL  %  (expected % row(s) affected, got %)',
      label, expected_rows, affected;
  end if;
  raise notice 'ok    % (% row(s) affected)', label, affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures. Inserting into auth.users fires public.handle_new_user(), so the
-- profiles below are produced by the trigger under test.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student.a@example.test', '{"first_name":"Ada","last_name":"Alpha"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'student.b@example.test', '{"first_name":"Ben","last_name":"Bravo"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@example.test', '{"first_name":"Cee","last_name":"Charlie"}'::jsonb),
  -- Signup metadata that tries to claim an elevated role.
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sneaky@example.test',
   '{"first_name":"Eve","last_name":"Echo","role":"admin"}'::jsonb);

update public.profiles set role = 'admin'
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
-- Schema-level guarantees
-- ---------------------------------------------------------------------------
select pg_temp.check_eq(
  'A1  profile trigger assigns role = student',
  (select role::text from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'student'
);

select pg_temp.check_eq(
  'A2  profile trigger copies first_name from signup metadata',
  (select first_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Ada'
);

select pg_temp.check_eq(
  'A3  signup metadata claiming role=admin is ignored',
  (select role::text from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'),
  'student'
);

select pg_temp.check_eq(
  'A4  RLS is enabled on all three Phase 1 tables',
  (select count(*)::int from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('profiles', 'courses', 'enrollments')
      and relrowsecurity),
  3
);

select pg_temp.check_eq(
  'A5  authenticated has no UPDATE grant on profiles.role',
  (select count(*)::int
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and grantee = 'authenticated'
      and privilege_type = 'UPDATE'),
  0
);

select pg_temp.check_eq(
  'A6  anon has no privileges at all on profiles',
  (select count(*)::int
     from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'anon'),
  0
);

select pg_temp.check_eq(
  'A7  anon has no privileges at all on enrollments',
  (select count(*)::int
     from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'enrollments'
      and grantee = 'anon'),
  0
);

-- ===========================================================================
-- Acting as Student A (a real `authenticated` connection with a JWT subject)
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq(
  '01  Student A can read their own profile',
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  1
);

select pg_temp.check_eq(
  '02  Student A cannot read Student B''s profile',
  (select count(*)::int from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  0
);

select pg_temp.check_eq(
  '02b Unfiltered profiles scan returns only Student A''s row',
  (select count(*)::int from public.profiles),
  1
);

select pg_temp.check_ok(
  '03  Student A can update their own first_name / last_name',
  $$update public.profiles set first_name = 'Adeline', last_name = 'Alpher'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_eq(
  '03b The profile update was persisted',
  (select first_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'Adeline'
);

select pg_temp.check_denied(
  '04  Student A cannot escalate their own role to admin',
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_denied(
  '04b Student A cannot change their profile email directly',
  $$update public.profiles set email = 'attacker@example.test'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_eq(
  '04c Student B''s profile is unreachable for update by Student A',
  (select count(*)::int from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  0
);

select pg_temp.check_eq(
  '05  Student A can read active courses',
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1
);

select pg_temp.check_eq(
  '06  Student A cannot read draft courses',
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0
);

select pg_temp.check_eq(
  '07  Student A can read their own enrollments',
  (select count(*)::int from public.enrollments
    where student_id = '11111111-1111-1111-1111-111111111111'),
  1
);

select pg_temp.check_eq(
  '08  Unfiltered enrollments scan returns only Student A''s row',
  (select count(*)::int from public.enrollments),
  1
);

select pg_temp.check_denied(
  '09  Student A cannot self-enroll',
  $$insert into public.enrollments (student_id, course_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000002', 'active')$$
);

select pg_temp.check_denied(
  '09b Student A cannot create an enrollment for Student B',
  $$insert into public.enrollments (student_id, course_id, status)
    values ('22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000001', 'completed')$$
);

select pg_temp.check_eq(
  '10  is_admin() is false for a student',
  public.is_admin(),
  false
);

select pg_temp.check_denied(
  '10b Student A cannot create courses',
  $$insert into public.courses (title, slug, status)
    values ('Pirate Course', 'pirate-course', 'active')$$
);

select pg_temp.check_affects(
  '10c Student A cannot publish a draft course',
  $$update public.courses set status = 'active'
     where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  0
);

select pg_temp.check_affects(
  '10d Student A cannot modify an active course they can see',
  $$update public.courses set title = 'Defaced'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  0
);

select pg_temp.check_affects(
  '10e Student A cannot delete another student''s enrollment',
  $$delete from public.enrollments
     where student_id = '22222222-2222-2222-2222-222222222222'$$,
  0
);

select pg_temp.check_affects(
  '10f Student A cannot cancel their own enrollment (no student UPDATE policy)',
  $$update public.enrollments set status = 'cancelled'
     where student_id = '11111111-1111-1111-1111-111111111111'$$,
  0
);

reset role;

-- ===========================================================================
-- Acting as the admin
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('11  is_admin() is true for an admin',
  public.is_admin(), true);

-- Confirm, with admin visibility, that none of Student A's attempted writes
-- above actually landed.
select pg_temp.check_eq('11a The draft course is still a draft',
  (select status::text from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'draft');

select pg_temp.check_eq('11b The active course title is unchanged',
  (select title from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Active Course');

select pg_temp.check_eq('11c Student B''s enrollment still exists and is active',
  (select status::text from public.enrollments
    where student_id = '22222222-2222-2222-2222-222222222222'), 'active');

select pg_temp.check_eq('11d Every profile still has the role it started with',
  (select count(*)::int from public.profiles where role = 'student'), 3);

select pg_temp.check_eq('12  An admin can read every profile',
  (select count(*)::int from public.profiles), 4);

select pg_temp.check_eq('13  An admin can read draft courses',
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 1);

select pg_temp.check_eq('14  An admin can read every enrollment',
  (select count(*)::int from public.enrollments), 2);

select pg_temp.check_ok('15  An admin can create a course',
  $$insert into public.courses (title, slug, status)
    values ('Admin Course', 'admin-course', 'draft')$$);

select pg_temp.check_ok('16  An admin can enroll a student',
  $$insert into public.enrollments (student_id, course_id, status)
    values ('44444444-4444-4444-4444-444444444444',
            'aaaaaaaa-0000-0000-0000-000000000001', 'active')$$);

select pg_temp.check_ok('17  An admin can correct another user''s name',
  $$update public.profiles set first_name = 'Benjamin'
     where id = '22222222-2222-2222-2222-222222222222'$$);

-- Role changes are impossible through the public API for EVERYONE, admins
-- included: the `authenticated` database role holds no UPDATE privilege on
-- profiles.role at all. Promotion is a privileged, out-of-band operation
-- (service-role key or SQL editor) — see README, "Promoting the first
-- administrator". This is deliberate: Phase 1 ships no role-management UI, so
-- there is no reason for the column to be writable from a browser session.
select pg_temp.check_denied('17b Not even an admin can write profiles.role via the API',
  $$update public.profiles set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$);

reset role;

-- ===========================================================================
-- The immutability trigger, tested in isolation.
--
-- WHY THIS SECTION EXISTS: every other assertion above is satisfied by the
-- column-level GRANT, which rejects the statement with 42501 before execution
-- ever reaches public.enforce_profile_immutable_columns(). That means the
-- whole suite passed while the trigger was a no-op — it had been declared
-- SECURITY DEFINER, which rebinds current_user to the function owner
-- (`postgres`), so its trusted-role allow-list matched on every call and every
-- check below it was skipped.
--
-- To test the trigger we must first remove the guard in front of it. These
-- assertions widen the GRANT exactly as a careless future migration would,
-- prove the trigger still refuses, and then put the GRANT back.
-- ===========================================================================
grant update on table public.profiles to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_denied(
  'T1  With the column GRANT widened, the trigger still blocks self-promotion',
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_denied(
  'T2  With the column GRANT widened, the trigger still blocks an email change',
  $$update public.profiles set email = 'attacker@example.test'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_denied(
  'T3  With the column GRANT widened, the trigger still blocks an id change',
  $$update public.profiles set id = '99999999-9999-9999-9999-999999999999'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_denied(
  'T4  With the column GRANT widened, created_at is still immutable',
  $$update public.profiles set created_at = now() - interval '10 years'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

select pg_temp.check_ok(
  'T5  ...while an ordinary name change still succeeds',
  $$update public.profiles set first_name = 'Still Editable'
     where id = '11111111-1111-1111-1111-111111111111'$$
);

reset role;

select pg_temp.check_eq('T6  Student A is still a student after all of that',
  (select role::text from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'student');

-- Restore the narrow grant.
revoke update on table public.profiles from authenticated;
grant update (first_name, last_name) on table public.profiles to authenticated;

select pg_temp.check_eq(
  'T7  The narrow column GRANT is back in place',
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and grantee = 'authenticated'
      and privilege_type = 'UPDATE'),
  0
);

select pg_temp.check_eq(
  'T8  The trigger is SECURITY INVOKER, not SECURITY DEFINER',
  (select prosecdef from pg_proc
    where proname = 'enforce_profile_immutable_columns'),
  false
);

-- ===========================================================================
-- The privileged server-side role (service-role key / SQL editor)
-- ===========================================================================
set local role service_role;

select pg_temp.check_ok('17c service_role CAN promote a user to admin',
  $$update public.profiles set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$);

select pg_temp.check_eq('17d The promotion was persisted',
  (select role::text from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'), 'admin');

reset role;

-- ===========================================================================
-- Anonymous visitors
-- ===========================================================================
select set_config('request.jwt.claims', '', true);
set local role anon;

select pg_temp.check_eq(
  '18  Anonymous visitors can read an active course',
  (select count(*)::int from public.courses
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1);

select pg_temp.check_eq(
  '18b Anonymous visitors cannot read draft courses',
  (select count(*)::int from public.courses
    where status <> 'active'), 0);

select pg_temp.check_denied(
  '19  Anonymous visitors cannot read profiles',
  $$select count(*) from public.profiles$$);

select pg_temp.check_denied(
  '20  Anonymous visitors cannot read enrollments',
  $$select count(*) from public.enrollments$$);

reset role;

-- ===========================================================================
-- Constraint checks
-- ===========================================================================
select pg_temp.check_error(
  '21  Duplicate enrollment rows are impossible (unique constraint)',
  $$insert into public.enrollments (student_id, course_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000001', 'active')$$,
  '23505'
);

select pg_temp.check_error(
  '22  A course slug must be unique',
  $$insert into public.courses (title, slug, status)
    values ('Duplicate', 'active-course', 'active')$$,
  '23505'
);

select pg_temp.check_error(
  '23  A course slug must be lower-case and hyphenated',
  $$insert into public.courses (title, slug, status)
    values ('Bad Slug', 'Not A Slug!', 'active')$$,
  '23514'
);

select pg_temp.check_error(
  '24  An enrollment cannot expire before it starts',
  $$insert into public.enrollments (student_id, course_id, enrolled_at, expires_at)
    values ('33333333-3333-3333-3333-333333333333',
            'aaaaaaaa-0000-0000-0000-000000000001',
            now(), now() - interval '1 day')$$,
  '23514'
);

rollback;
