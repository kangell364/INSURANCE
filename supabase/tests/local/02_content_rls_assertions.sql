-- ===========================================================================
-- Phase 2 content RLS assertions — plain SQL, no pgTAP required.
--
-- What this file is for: proving that the public syllabus is public and the
-- paid body is not. Everything else here is in service of those two sentences.
--
-- The assertion helpers below are a deliberate copy of the ones in
-- 01_rls_assertions.sql rather than a shared include. A test file that can be
-- run on its own (`psql -f 02_...`) against a migrated database is worth more
-- than the half-dozen duplicated lines it costs, and a shared helper module
-- would be a third mechanism to keep working.
-- ===========================================================================

\set ON_ERROR_STOP on

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
-- Fixtures
--
-- Five users covering every enrollment state that should decide access:
--   S1  live enrollment          -> may read published bodies
--   S2  no enrollment            -> may read the syllabus only
--   S3  admin                    -> may read everything
--   S4  enrollment, but EXPIRED  -> may read the syllabus only
--   S5  enrollment, CANCELLED    -> may read the syllabus only
--
-- Four lessons covering every reason a body should stay hidden:
--   L1  published, in a published module of an active course  -> visible
--   L2  DRAFT lesson                                          -> hidden
--   L3  published lesson in a DRAFT module                    -> hidden
--   L4  published lesson in a DRAFT COURSE                    -> hidden
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'enrolled@example.test', '{"first_name":"Ada"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'browsing@example.test', '{"first_name":"Ben"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@example.test', '{"first_name":"Cee"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'expired@example.test', '{"first_name":"Dee"}'::jsonb),
  ('55555555-5555-5555-5555-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cancelled@example.test', '{"first_name":"Eve"}'::jsonb);

update public.profiles set role = 'admin'
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.courses (id, title, slug, description, status) values
  ('c0000000-0000-0000-0000-000000000001', 'Live Course', 'live-course',
   'Active.', 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'Unreleased Course',
   'unreleased-course', 'Draft.', 'draft');

insert into public.modules (id, course_id, title, position, status) values
  ('d0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'Published Module', 1, 'active'),
  ('d0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'Draft Module', 2, 'draft'),
  ('d0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000002', 'Module In Draft Course', 1,
   'active');

insert into public.lessons
  (id, module_id, course_id, title, slug, position, status, estimated_minutes)
values
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Published Lesson', 'published-lesson', 1, 'active', 20),
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'Draft Lesson', 'draft-lesson', 2, 'draft', null),
  ('e0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001',
   'Lesson In Draft Module', 'lesson-in-draft-module', 1, 'active', null),
  ('e0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000002',
   'Lesson In Draft Course', 'lesson-in-draft-course', 1, 'active', null);

insert into public.lesson_contents (lesson_id, course_id, body) values
  ('e0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', 'PAID BODY — published'),
  ('e0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001', 'PAID BODY — draft lesson'),
  ('e0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000001', 'PAID BODY — draft module'),
  ('e0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000002', 'PAID BODY — draft course');

insert into public.topics (id, course_id, parent_topic_id, code, name,
                           blueprint_weight, position)
values
  ('f0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001', null, 'P&C.01',
   'Insurance Fundamentals', 15.00, 1),
  ('f0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001', 'P&C.01.01', 'Risk and Insurance',
   null, 1),
  ('f0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000002', null, 'X.01', 'Hidden Topic',
   null, 1);

-- Three tags, on purpose: one on the published lesson and two on lessons that
-- must stay hidden. An earlier version of these fixtures tagged only the
-- published lesson, which meant a policy rewritten to `using (true)` returned
-- the same single row and the assertion below passed while the table was wide
-- open. A visibility test needs at least one row that is supposed to be
-- invisible.
insert into public.lesson_topics (lesson_id, topic_id, course_id) values
  ('e0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001'),
  -- On the DRAFT lesson.
  ('e0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000001'),
  -- On a lesson in the DRAFT COURSE.
  ('e0000000-0000-0000-0000-000000000004',
   'f0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000002');

insert into public.enrollments (student_id, course_id, status, enrolled_at,
                                expires_at)
values
  ('11111111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-000000000001', 'active', now(), null),
  ('44444444-4444-4444-4444-444444444444',
   'c0000000-0000-0000-0000-000000000001', 'active',
   now() - interval '2 years', now() - interval '1 year'),
  ('55555555-5555-5555-5555-555555555555',
   'c0000000-0000-0000-0000-000000000001', 'cancelled', now(), null);

-- ===========================================================================
-- Schema-level guarantees
-- ===========================================================================
select pg_temp.check_eq(
  'C1  RLS is enabled on all five content tables',
  (select count(*)::int from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('modules', 'lessons', 'lesson_contents', 'topics',
                      'lesson_topics')
      and relrowsecurity),
  5
);

select pg_temp.check_eq(
  'C2  anon holds NO privilege of any kind on lesson_contents',
  (select count(*)::int from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'lesson_contents'
      and grantee = 'anon'),
  0
);

select pg_temp.check_eq(
  'C3  is_enrolled_in_course is SECURITY INVOKER',
  (select prosecdef from pg_proc where proname = 'is_enrolled_in_course'),
  false
);

select pg_temp.check_eq(
  'C4  lesson_is_published is SECURITY INVOKER',
  (select prosecdef from pg_proc where proname = 'lesson_is_published'),
  false
);

select pg_temp.check_eq(
  'C5  enforce_topic_depth is SECURITY INVOKER',
  (select prosecdef from pg_proc where proname = 'enforce_topic_depth'),
  false
);

-- ===========================================================================
-- public.lesson_is_published() — the function's own contract
--
-- WHY THESE RUN UNPRIVILEGED-ROLE-FREE: these assertions deliberately execute
-- as the migration role, with no `set role`, so RLS is bypassed and the
-- function's own status checks are the only thing filtering.
--
-- That distinction was not obvious, and it is the reason this block exists. A
-- mutation that reduced lesson_is_published() to checking only the lesson's
-- own status -- dropping the module and course checks -- passed every
-- end-to-end assertion in this file. It passed because a STUDENT calling the
-- function reads public.lessons through that table's RLS policy, which has
-- already removed lessons under a draft module or an archived course. The
-- shallow function returned the right answer for the wrong reason, and the
-- moment an admin, a service-role job or a future SECURITY DEFINER caller used
-- it -- none of whom are filtered by that policy -- it would have returned
-- true for an unpublished lesson.
--
-- Testing only through the student's eyes hid a real defect. These four lines
-- test the function directly.
-- ===========================================================================
select pg_temp.check_eq(
  'I1  lesson_is_published() is true for a fully published lesson',
  public.lesson_is_published('e0000000-0000-0000-0000-000000000001'), true);

select pg_temp.check_eq(
  'I2  ...false for a draft lesson',
  public.lesson_is_published('e0000000-0000-0000-0000-000000000002'), false);

select pg_temp.check_eq(
  'I3  ...false for a published lesson in a DRAFT MODULE',
  public.lesson_is_published('e0000000-0000-0000-0000-000000000003'), false);

select pg_temp.check_eq(
  'I4  ...false for a published lesson in a DRAFT COURSE',
  public.lesson_is_published('e0000000-0000-0000-0000-000000000004'), false);

select pg_temp.check_eq(
  'I5  ...false for a lesson id that does not exist',
  public.lesson_is_published('00000000-0000-0000-0000-0000000000ff'), false);

-- ===========================================================================
-- Anonymous visitors — the syllabus is public, the body is not
-- ===========================================================================
select set_config('request.jwt.claims', '', true);
set local role anon;

select pg_temp.check_eq('A1  Anon sees the published module',
  (select count(*)::int from public.modules), 1);

select pg_temp.check_eq('A2  Anon sees the published lesson, and only it',
  (select count(*)::int from public.lessons), 1);

select pg_temp.check_eq('A3  ...and it is the right one',
  (select title from public.lessons), 'Published Lesson');

select pg_temp.check_eq('A4  Anon sees the active course''s topics only',
  (select count(*)::int from public.topics), 2);

select pg_temp.check_eq(
  'A5  Anon sees the published lesson''s tag and neither hidden one',
  (select count(*)::int from public.lesson_topics), 1);

select pg_temp.check_eq('A5b ...and it is the tag on the published lesson',
  (select lesson_id::text from public.lesson_topics),
  'e0000000-0000-0000-0000-000000000001');

select pg_temp.check_denied(
  'A6  Anon is refused lesson_contents by the privilege system',
  $$select count(*) from public.lesson_contents$$);

select pg_temp.check_denied('A7  Anon cannot write modules',
  $$insert into public.modules (course_id, title, position, status)
    values ('c0000000-0000-0000-0000-000000000001', 'Pirate', 9, 'active')$$);

reset role;

-- ===========================================================================
-- A signed-in visitor with NO enrollment
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('B1  Browsing student sees the public syllabus',
  (select count(*)::int from public.lessons), 1);

select pg_temp.check_eq('B1b ...and only the published lesson''s topic tags',
  (select count(*)::int from public.lesson_topics), 1);

select pg_temp.check_eq(
  'B2  Browsing student reads ZERO lesson bodies',
  (select count(*)::int from public.lesson_contents), 0);

select pg_temp.check_eq(
  'B3  ...including by asking for the published one by id',
  (select count(*)::int from public.lesson_contents
    where lesson_id = 'e0000000-0000-0000-0000-000000000001'), 0);

select pg_temp.check_eq('B4  is_enrolled_in_course() is false for them',
  public.is_enrolled_in_course('c0000000-0000-0000-0000-000000000001'), false);

select pg_temp.check_affects('B5  They cannot publish the draft module',
  $$update public.modules set status = 'active'
     where id = 'd0000000-0000-0000-0000-000000000002'$$, 0);

select pg_temp.check_affects('B6  They cannot edit a lesson title',
  $$update public.lessons set title = 'Defaced'
     where id = 'e0000000-0000-0000-0000-000000000001'$$, 0);

select pg_temp.check_affects('B7  They cannot delete a topic',
  $$delete from public.topics
     where id = 'f0000000-0000-0000-0000-000000000002'$$, 0);

select pg_temp.check_denied('B8  They cannot insert a lesson',
  $$insert into public.lessons
      (module_id, course_id, title, slug, position, status)
    values ('d0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001',
            'Pirate Lesson', 'pirate-lesson', 9, 'active')$$);

select pg_temp.check_denied('B9  They cannot write themselves a lesson body',
  $$insert into public.lesson_contents (lesson_id, course_id, body)
    values ('e0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001', 'x')$$);

reset role;

-- ===========================================================================
-- The enrolled student — the one caller who may read a body
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('D1  is_enrolled_in_course() is true',
  public.is_enrolled_in_course('c0000000-0000-0000-0000-000000000001'), true);

select pg_temp.check_eq(
  'D2  An unfiltered scan returns exactly ONE body',
  (select count(*)::int from public.lesson_contents), 1);

select pg_temp.check_eq('D3  ...the published lesson''s',
  (select body from public.lesson_contents), 'PAID BODY — published');

select pg_temp.check_eq(
  'D4  The DRAFT lesson''s body is hidden even from an enrolled student',
  (select count(*)::int from public.lesson_contents
    where lesson_id = 'e0000000-0000-0000-0000-000000000002'), 0);

select pg_temp.check_eq(
  'D5  A body under a DRAFT MODULE is hidden',
  (select count(*)::int from public.lesson_contents
    where lesson_id = 'e0000000-0000-0000-0000-000000000003'), 0);

select pg_temp.check_eq(
  'D6  A body in a DRAFT COURSE is hidden',
  (select count(*)::int from public.lesson_contents
    where lesson_id = 'e0000000-0000-0000-0000-000000000004'), 0);

select pg_temp.check_eq(
  'D7  Enrollment grants no write access to the content',
  (select count(*)::int from public.lesson_contents), 1);

select pg_temp.check_affects('D8  They cannot edit the body they can read',
  $$update public.lesson_contents set body = 'Defaced'
     where lesson_id = 'e0000000-0000-0000-0000-000000000001'$$, 0);

reset role;

-- ===========================================================================
-- Expired and cancelled enrollments — access is a live state, not a memory
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('E1  An EXPIRED enrollment reads no bodies',
  (select count(*)::int from public.lesson_contents), 0);

select pg_temp.check_eq('E2  is_enrolled_in_course() is false when expired',
  public.is_enrolled_in_course('c0000000-0000-0000-0000-000000000001'), false);

select pg_temp.check_eq('E3  ...but the syllabus is still readable',
  (select count(*)::int from public.lessons), 1);

reset role;

select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('E4  A CANCELLED enrollment reads no bodies',
  (select count(*)::int from public.lesson_contents), 0);

select pg_temp.check_eq('E5  is_enrolled_in_course() is false when cancelled',
  public.is_enrolled_in_course('c0000000-0000-0000-0000-000000000001'), false);

reset role;

-- ===========================================================================
-- The admin
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('F1  An admin sees every module',
  (select count(*)::int from public.modules), 3);

select pg_temp.check_eq('F2  An admin sees every lesson',
  (select count(*)::int from public.lessons), 4);

select pg_temp.check_eq('F3  An admin sees every body, enrolled or not',
  (select count(*)::int from public.lesson_contents), 4);

select pg_temp.check_eq('F4  An admin sees the draft course''s topics',
  (select count(*)::int from public.topics), 3);

select pg_temp.check_eq('F4b An admin sees every lesson-topic tag',
  (select count(*)::int from public.lesson_topics), 3);

select pg_temp.check_ok('F5  An admin can author a module',
  $$insert into public.modules (course_id, title, position, status)
    values ('c0000000-0000-0000-0000-000000000001', 'New Module', 3, 'draft')$$);

select pg_temp.check_ok('F6  An admin can publish a draft lesson',
  $$update public.lessons set status = 'active'
     where id = 'e0000000-0000-0000-0000-000000000002'$$);

select pg_temp.check_ok('F7  An admin can edit a lesson body',
  $$update public.lesson_contents set body = 'Edited by an admin'
     where lesson_id = 'e0000000-0000-0000-0000-000000000001'$$);

reset role;

-- ===========================================================================
-- Structural integrity — the guarantees that are the schema's job, not RLS's
-- ===========================================================================

select pg_temp.check_error(
  'G1  A lesson cannot claim a course its module does not belong to',
  $$insert into public.lessons
      (module_id, course_id, title, slug, position, status)
    values ('d0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000002',
            'Mismatched', 'mismatched', 8, 'active')$$,
  '23503'
);

select pg_temp.check_error(
  'G2  A lesson cannot be tagged with another course''s topic',
  $$insert into public.lesson_topics (lesson_id, topic_id, course_id)
    values ('e0000000-0000-0000-0000-000000000001',
            'f0000000-0000-0000-0000-000000000003',
            'c0000000-0000-0000-0000-000000000001')$$,
  '23503'
);

-- Written as an UPDATE rather than an INSERT on purpose: every lesson in the
-- fixtures already has a body row, so an INSERT would trip the primary key
-- (23505) before the foreign key was ever consulted, and the assertion would
-- pass for the wrong reason.
select pg_temp.check_error(
  'G3  A lesson body cannot be re-pointed at the wrong course',
  $$update public.lesson_contents
       set course_id = 'c0000000-0000-0000-0000-000000000002'
     where lesson_id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23503'
);

select pg_temp.check_error(
  'G4  Topics cannot nest more than one level deep',
  $$insert into public.topics (course_id, parent_topic_id, code, name, position)
    values ('c0000000-0000-0000-0000-000000000001',
            'f0000000-0000-0000-0000-000000000002', 'P&C.01.01.01',
            'Too Deep', 1)$$,
  '23514'
);

select pg_temp.check_error(
  'G5  A topic cannot be its own parent',
  $$update public.topics
       set parent_topic_id = 'f0000000-0000-0000-0000-000000000001'
     where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '23514'
);

select pg_temp.check_error(
  'G6  A two-row topic cycle is impossible',
  $$update public.topics
       set parent_topic_id = 'f0000000-0000-0000-0000-000000000002'
     where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '23514'
);

select pg_temp.check_error(
  'G7  Deleting a parent topic that still has children is refused',
  $$delete from public.topics
     where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '23503'
);

select pg_temp.check_error(
  'G8  Two modules cannot share a position in one course',
  $$insert into public.modules (course_id, title, position, status)
    values ('c0000000-0000-0000-0000-000000000001', 'Clash', 1, 'active')$$,
  '23505'
);

select pg_temp.check_error(
  'G9  A blueprint weight above 100% is rejected',
  $$insert into public.topics (course_id, code, name, blueprint_weight, position)
    values ('c0000000-0000-0000-0000-000000000001', 'P&C.99', 'Bad', 101, 9)$$,
  '23514'
);

-- The reason modules_course_position_key is DEFERRABLE: swapping two modules'
-- positions passes through a state where both hold the same value. With an
-- immediate constraint this transaction is impossible without a sentinel.
--
-- The swap cannot be wrapped in its own BEGIN/COMMIT -- this whole file runs
-- inside one transaction, and plpgsql cannot open another. Instead the
-- constraint is deferred, the rows are swapped, and it is set back to
-- IMMEDIATE, which forces the check right there. If the constraint were not
-- deferrable, or the deferral did not work, that statement raises and the
-- script aborts. The `set constraints` pair IS the assertion.
set constraints public.modules_course_position_key deferred;

update public.modules set position = 2
 where id = 'd0000000-0000-0000-0000-000000000001';
update public.modules set position = 1
 where id = 'd0000000-0000-0000-0000-000000000002';

set constraints public.modules_course_position_key immediate;

select pg_temp.check_eq('G10 Two modules can swap positions in one transaction',
  (select position from public.modules
    where id = 'd0000000-0000-0000-0000-000000000001'), 2);

select pg_temp.check_eq('G11 ...and the swap landed',
  (select position from public.modules
    where id = 'd0000000-0000-0000-0000-000000000002'), 1);

-- Unpublishing a module must take its lessons' bodies with it. This is the
-- assertion that catches a future refactor which "optimises" the policy by
-- checking only the lesson's own status.
update public.modules set status = 'draft'
 where id = 'd0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq(
  'H1  Unpublishing the module hides its lesson from the syllabus',
  (select count(*)::int from public.lessons), 0);

select pg_temp.check_eq(
  'H2  ...and revokes the enrolled student''s access to the body',
  (select count(*)::int from public.lesson_contents), 0);

reset role;

rollback;
