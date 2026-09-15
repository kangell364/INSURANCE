-- ===========================================================================
-- Progress (lesson_completions) RLS assertions.
--
-- The question this file answers: a student may write here, so what exactly
-- can they write? Specifically, can they record progress against a lesson
-- they cannot read, another student's account, or a course they never paid
-- for.
--
-- Helpers are duplicated from the suites beside this one, for the same reason
-- given there: a test file that runs on its own against a migrated database
-- is worth more than the lines it saves.
-- ===========================================================================

\set ON_ERROR_STOP on

begin;


begin;

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
-- Fixtures: an enrolled student, an unenrolled one, a lapsed one, an admin.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'enrolled@example.test', '{"first_name":"Ada"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'other@example.test', '{"first_name":"Ben"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@example.test', '{"first_name":"Cee"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lapsed@example.test', '{"first_name":"Dee"}'::jsonb);

update public.profiles set role = 'admin'
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.courses (id, title, slug, status) values
  ('c0000000-0000-0000-0000-000000000001', 'Live Course', 'live-course',
   'active');

insert into public.modules (id, course_id, title, position, status) values
  ('d0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Published Module', 1, 'active');

insert into public.lessons
  (id, module_id, course_id, title, slug, position, status)
values
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Published Lesson', 'published-lesson', 1, 'active'),
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Draft Lesson', 'draft-lesson', 2, 'draft');

insert into public.enrollments (student_id, course_id, status, enrolled_at,
                                expires_at)
values
  ('11111111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-000000000001', 'active', now(), null),
  ('44444444-4444-4444-4444-444444444444',
   'c0000000-0000-0000-0000-000000000001', 'active',
   now() - interval '2 years', now() - interval '1 year');

-- ===========================================================================
-- Schema-level guarantees
-- ===========================================================================
select pg_temp.check_eq('P1  RLS is enabled on lesson_completions',
  (select relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace
      and relname = 'lesson_completions'), true);

select pg_temp.check_eq('P2  anon holds no privilege on lesson_completions',
  (select count(*)::int from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'lesson_completions'
      and grantee = 'anon'), 0);

select pg_temp.check_eq(
  'P3  Nobody holds UPDATE on lesson_completions — a completion is immutable',
  (select count(*)::int from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'lesson_completions'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'UPDATE'), 0);

-- ===========================================================================
-- The enrolled student
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_ok('Q1  An enrolled student can mark a published lesson read',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('11111111-1111-1111-1111-111111111111',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_eq('Q2  ...and reads it back',
  (select count(*)::int from public.lesson_completions), 1);

select pg_temp.check_denied(
  'Q3  ...but cannot mark a DRAFT lesson, which no progress total counts',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('11111111-1111-1111-1111-111111111111',
            'e0000000-0000-0000-0000-000000000002',
            'c0000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_denied(
  'Q4  ...and cannot record progress for ANOTHER student',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('22222222-2222-2222-2222-222222222222',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_error(
  'Q5  Marking the same lesson twice is refused, not duplicated',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('11111111-1111-1111-1111-111111111111',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$,
  '23505');

select pg_temp.check_denied(
  'Q6  A completion cannot be back-dated — no UPDATE privilege exists',
  $$update public.lesson_completions set completed_at = now() - interval '1 year'
     where lesson_id = 'e0000000-0000-0000-0000-000000000001'$$);

select pg_temp.check_affects('Q7  A student can un-mark their own lesson',
  $$delete from public.lesson_completions
     where lesson_id = 'e0000000-0000-0000-0000-000000000001'$$, 1);

select pg_temp.check_ok('Q8  ...and mark it again afterwards',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('11111111-1111-1111-1111-111111111111',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

reset role;

-- ===========================================================================
-- A student with no enrollment
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_denied(
  'R1  An unenrolled student cannot record progress at all',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('22222222-2222-2222-2222-222222222222',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_eq(
  'R2  ...and cannot see anyone else''s progress',
  (select count(*)::int from public.lesson_completions), 0);

select pg_temp.check_affects(
  'R3  ...and cannot delete another student''s completion',
  $$delete from public.lesson_completions
     where student_id = '11111111-1111-1111-1111-111111111111'$$, 0);

reset role;

-- ===========================================================================
-- A lapsed enrollment
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_denied(
  'S1  An expired enrollment cannot record new progress',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('44444444-4444-4444-4444-444444444444',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

reset role;

-- A student whose access lapses must still be able to clear rows they own:
-- data you own and cannot delete is not a reasonable thing to ship.
insert into public.lesson_completions (student_id, lesson_id, course_id)
values ('44444444-4444-4444-4444-444444444444',
        'e0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_affects(
  'S2  ...but can still delete a completion it already owns',
  $$delete from public.lesson_completions
     where student_id = '44444444-4444-4444-4444-444444444444'$$, 1);

reset role;

-- ===========================================================================
-- The admin
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('T1  An admin can read every student''s progress',
  (select count(*)::int from public.lesson_completions), 1);

select pg_temp.check_denied(
  'T2  ...but cannot fabricate progress for a student',
  $$insert into public.lesson_completions (student_id, lesson_id, course_id)
    values ('22222222-2222-2222-2222-222222222222',
            'e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_affects(
  'T3  ...and cannot delete a student''s progress',
  $$delete from public.lesson_completions
     where student_id = '11111111-1111-1111-1111-111111111111'$$, 0);

reset role;

-- ===========================================================================
-- Cascade behaviour
-- ===========================================================================
delete from public.lessons where id = 'e0000000-0000-0000-0000-000000000001';

select pg_temp.check_eq(
  'U1  Deleting a lesson removes the completions pointing at it',
  (select count(*)::int from public.lesson_completions), 0);

rollback;
