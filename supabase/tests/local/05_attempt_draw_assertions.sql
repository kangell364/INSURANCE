-- ===========================================================================
-- Paper assembly assertions — plain SQL, no pgTAP required.
--
-- What this file is for, in one sentence: proving that a student cannot
-- choose which questions appear on their own paper.
--
-- 04_ proves a student cannot read the answer key or mark their own paper.
-- This is the third leg. Until start_attempt() existed, a student held
-- `insert` on attempt_questions and RLS checked only that the attempt was
-- theirs -- so they could assemble a five-question "mock", score 100%, and
-- move their own readiness figure, which is computed from mock attempts.
--
-- The helpers are copied from 01_, 02_ and 04_ rather than shared, on the
-- same reasoning recorded there.
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
        raise notice 'ok    % (rejected %)', label, sqlstate;
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

-- --------------------------------------------------------------------------
-- Fixture. Two topics with blueprint counts of 3 and 2, one module with two
-- lessons, and a question bank that deliberately contains one DRAFT and one
-- MOCK-ONLY question so the draw's filters can be observed rather than
-- assumed.
-- --------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'enrolled@example.com'),
  ('a2000000-0000-0000-0000-000000000002', 'outsider@example.com');

insert into public.courses (id, title, slug, status) values
  ('c1000000-0000-0000-0000-000000000001', 'Course', 'course', 'active');

insert into public.modules (id, course_id, title, position, status) values
  ('d1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'Module One', 1, 'active');

insert into public.topics (id, course_id, code, name, position, question_count) values
  ('e1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'GK.I', 'One', 1, 3),
  ('e2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001', 'GK.II', 'Two', 2, 2);

insert into public.lessons (id, course_id, module_id, title, slug, position, status) values
  ('f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001', 'Lesson One', 'lesson-one', 1, 'active'),
  ('f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001', 'Lesson Two', 'lesson-two', 2, 'active');

insert into public.enrollments (student_id, course_id, status) values
  ('a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001', 'active');

-- Six publishable questions on lesson one, topic one.
insert into public.questions (id, course_id, topic_id, lesson_id, stem, status, mock_only)
select ('b1000000-0000-0000-0000-00000000000' || i)::uuid,
       'c1000000-0000-0000-0000-000000000001',
       'e1000000-0000-0000-0000-000000000001',
       'f1000000-0000-0000-0000-000000000001',
       'Question ' || i, 'active', false
  from generate_series(1, 6) i;

-- One draft (nobody has checked its answer key) and one reserved for mocks.
insert into public.questions (id, course_id, topic_id, lesson_id, stem, status, mock_only) values
  ('b1000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'Unreviewed', 'draft', false),
  ('b1000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'Held back for mocks', 'active', true);

insert into public.questions (id, course_id, topic_id, lesson_id, stem, status, mock_only)
select ('b2000000-0000-0000-0000-00000000000' || i)::uuid,
       'c1000000-0000-0000-0000-000000000001',
       'e2000000-0000-0000-0000-000000000002',
       'f2000000-0000-0000-0000-000000000002',
       'Second topic ' || i, 'active', false
  from generate_series(1, 4) i;

-- ===========================================================================
-- A. A STUDENT CANNOT BUILD THEIR OWN PAPER
--
-- The claim this file exists for.
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_attempt uuid;
begin
  v_attempt := public.start_attempt(
    'c1000000-0000-0000-0000-000000000001', 'mock'::public.attempt_kind);
  perform set_config('test.attempt', v_attempt::text, true);
end $$;

select pg_temp.check_denied(
  'A1  A student cannot INSERT a question of their choosing into their paper',
  format($$insert into public.attempt_questions
             (attempt_id, student_id, question_id, position)
           values (%L, 'a1000000-0000-0000-0000-000000000001',
                   'b1000000-0000-0000-0000-000000000001', 99)$$,
         current_setting('test.attempt')));

-- Answering must still work: it is an UPDATE to selected_option_id, and the
-- revoke was deliberately narrowed to INSERT so that it does.
select pg_temp.check_eq(
  'A2  ...but can still answer the paper they were given',
  (select count(*) > 0 from public.attempt_questions
    where attempt_id = current_setting('test.attempt')::uuid),
  true);

-- ===========================================================================
-- B. THE DRAW RESPECTS THE REVIEW GATE AND THE HOLDOUT
-- ===========================================================================
do $$
declare v_attempt uuid;
begin
  v_attempt := public.start_attempt(
    'c1000000-0000-0000-0000-000000000001', 'quiz'::public.attempt_kind,
    'f1000000-0000-0000-0000-000000000001');
  perform set_config('test.quiz', v_attempt::text, true);
end $$;

select pg_temp.check_eq(
  'B1  A quiz draws every publishable question for its lesson',
  (select count(*)::int from public.attempt_questions
    where attempt_id = current_setting('test.quiz')::uuid),
  6);

select pg_temp.check_eq(
  'B2  ...and never a DRAFT question, whose answer key nobody has checked',
  (select count(*)::int from public.attempt_questions aq
     join public.questions q on q.id = aq.question_id
    where aq.attempt_id = current_setting('test.quiz')::uuid
      and q.status = 'draft'::public.content_status),
  0);

select pg_temp.check_eq(
  'B3  ...and never a question reserved for mocks',
  (select count(*)::int from public.attempt_questions aq
     join public.questions q on q.id = aq.question_id
    where aq.attempt_id = current_setting('test.quiz')::uuid
      and q.mock_only),
  0);

-- ===========================================================================
-- C. A MOCK IS BLUEPRINT-WEIGHTED, AND MAY USE THE HOLDOUT
-- ===========================================================================
select pg_temp.check_eq(
  'C1  A mock draws each topic''s published question_count, not a round number',
  (select count(*)::int from public.attempt_questions
    where attempt_id = current_setting('test.attempt')::uuid),
  5);   -- 3 from GK.I + 2 from GK.II

select pg_temp.check_eq(
  'C2  question_count records what was actually drawn, so a short paper is honest',
  (select question_count from public.attempts
    where id = current_setting('test.attempt')::uuid),
  5);

-- ===========================================================================
-- D. SCOPE AND AUTHORISATION
-- ===========================================================================
do $$
declare v_attempt uuid;
begin
  v_attempt := public.start_attempt(
    'c1000000-0000-0000-0000-000000000001', 'module'::public.attempt_kind,
    null, 'd1000000-0000-0000-0000-000000000001');
  perform set_config('test.module', v_attempt::text, true);
end $$;

select pg_temp.check_eq(
  'D1  A module test spans its module''s lessons',
  (select count(*)::int from public.attempt_questions
    where attempt_id = current_setting('test.module')::uuid),
  10);  -- 6 from lesson one + 4 from lesson two; draft and mock-only excluded

select pg_temp.check_eq(
  'D2  ...and is forced to on_submit, so it measures rather than teaches',
  (select reveal from public.attempts
    where id = current_setting('test.module')::uuid),
  'on_submit'::public.reveal_mode);

-- An outsider holds a valid token and no enrollment.
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select pg_temp.check_error(
  'D3  A student with no enrollment cannot start an attempt',
  $$select public.start_attempt(
      'c1000000-0000-0000-0000-000000000001', 'mock'::public.attempt_kind)$$,
  '42501');

set local role anon;
select set_config('request.jwt.claims', '', true);

select pg_temp.check_denied(
  'D4  An anonymous visitor cannot execute start_attempt at all',
  $$select public.start_attempt(
      'c1000000-0000-0000-0000-000000000001', 'mock'::public.attempt_kind)$$);

rollback;
