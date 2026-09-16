-- ===========================================================================
-- Phase 3 assessment RLS assertions — plain SQL, no pgTAP required.
--
-- What this file is for, in one sentence: proving that a student holding a
-- browser token cannot obtain the answer key by ANY route, and cannot mark
-- their own paper.
--
-- Everything else here serves those two claims. The original brief required
-- that students be unable to discover correct answers through developer
-- tools, network responses, page source or direct Supabase queries; this file
-- is the part of that requirement which can actually be tested, because the
-- first three all reduce to "what does the database hand to an authenticated
-- token".
--
-- The helpers are copied from 01_ and 02_ rather than shared, on the same
-- reasoning recorded there.
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
-- Two students, one admin:
--   S1  live enrollment   -> may read published questions, may sit attempts
--   S2  no enrollment     -> may read nothing of the bank
--   A1  admin             -> may manage the bank
--
-- Two questions:
--   Q1  published  -> visible to S1
--   Q2  draft      -> visible to nobody but the admin
--
-- Each has two options and an answer key entry. The key is what must never
-- escape.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sitter@example.test', '{"first_name":"Sam"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'outsider@example.test', '{"first_name":"Oli"}'::jsonb),
  ('a3333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bankadmin@example.test', '{"first_name":"Ash"}'::jsonb);

update public.profiles set role = 'admin'
 where id = 'a3333333-3333-3333-3333-333333333333';

insert into public.courses (id, title, slug, description, status) values
  ('cc000000-0000-0000-0000-000000000001', 'Exam Course', 'exam-course',
   'Active.', 'active');

insert into public.enrollments (student_id, course_id, status) values
  ('a1111111-1111-1111-1111-111111111111',
   'cc000000-0000-0000-0000-000000000001', 'active');

insert into public.topics (id, course_id, code, name, position, question_count)
values ('cd000000-0000-0000-0000-000000000001',
        'cc000000-0000-0000-0000-000000000001', 'GK.I', 'Types of Policies',
        1, 22);

insert into public.questions (id, course_id, topic_id, stem, explanation, status)
values
  ('ce000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001',
   'cd000000-0000-0000-0000-000000000001',
   'Under an HO-3, how are the contents covered?',
   'Dwelling is open peril; contents are named peril.', 'active'),
  ('ce000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000001',
   'cd000000-0000-0000-0000-000000000001',
   'A draft question nobody should see.', 'Unreviewed.', 'draft');

insert into public.question_options (id, question_id, course_id, body, position)
values
  ('cf000000-0000-0000-0000-000000000001',
   'ce000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001', 'Named peril', 1),
  ('cf000000-0000-0000-0000-000000000002',
   'ce000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001', 'Open peril', 2),
  ('cf000000-0000-0000-0000-000000000003',
   'ce000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000001', 'Draft option A', 1),
  ('cf000000-0000-0000-0000-000000000004',
   'ce000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000001', 'Draft option B', 2);

insert into public.question_answers (question_id, course_id, correct_option_id)
values
  ('ce000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001',
   'cf000000-0000-0000-0000-000000000001'),
  ('ce000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000001',
   'cf000000-0000-0000-0000-000000000003');

-- ===========================================================================
-- A. THE ANSWER KEY IS UNREACHABLE
--
-- The claim the whole design rests on. If any assertion in this block fails,
-- the product is broken in a way no amount of UI care can repair.
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_denied('A1  An enrolled student cannot SELECT the answer key',
  'select * from public.question_answers');

select pg_temp.check_denied('A2  ...cannot count it either',
  'select count(*) from public.question_answers');

select pg_temp.check_denied('A3  ...cannot join to it from a table they CAN read',
  'select q.id from public.questions q
     join public.question_answers a on a.question_id = q.id');

select pg_temp.check_denied('A4  ...cannot reach it through a subquery',
  'select (select correct_option_id from public.question_answers limit 1)');

select pg_temp.check_denied('A5  ...cannot insert their own key',
  $$insert into public.question_answers (question_id, course_id, correct_option_id)
    values ('ce000000-0000-0000-0000-000000000001',
            'cc000000-0000-0000-0000-000000000001',
            'cf000000-0000-0000-0000-000000000002')$$);

select pg_temp.check_denied('A6  ...cannot rewrite an existing key',
  $$update public.question_answers set correct_option_id =
      'cf000000-0000-0000-0000-000000000002'$$);

select pg_temp.check_denied('A7  ...cannot delete a key to break scoring',
  'delete from public.question_answers');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

-- The one that catches a well-meaning future change. Somebody will eventually
-- add a policy so the admin screens can show the key; the grant is what stops
-- it, and this asserts the grant is still absent.
select pg_temp.check_denied('A8  Even an ADMIN token cannot read the key directly',
  'select * from public.question_answers');

reset role;
-- ===========================================================================
-- B. THE QUESTION BANK IS FOR PAYING STUDENTS
-- ===========================================================================
select set_config('request.jwt.claims', '', true);
set local role anon;

select pg_temp.check_denied('B1  An anonymous visitor cannot read questions at all',
  'select * from public.questions');
select pg_temp.check_denied('B2  ...nor the options',
  'select * from public.question_options');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('B3  A signed-in NON-enrolled student sees no questions',
  (select count(*) from public.questions), 0::bigint);
select pg_temp.check_eq('B4  ...and no options',
  (select count(*) from public.question_options), 0::bigint);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('B5  An enrolled student sees the PUBLISHED question only',
  (select count(*) from public.questions), 1::bigint);
select pg_temp.check_eq('B6  ...and only its options, not the draft question''s',
  (select count(*) from public.question_options), 2::bigint);
select pg_temp.check_eq('B7  ...the draft question is invisible by id',
  (select count(*) from public.questions
    where id = 'ce000000-0000-0000-0000-000000000002'), 0::bigint);

-- The bank is the product. A student who could edit it could rewrite the
-- question to match the answer they wanted.
select pg_temp.check_denied('B8  A student cannot insert a question',
  $$insert into public.questions (course_id, topic_id, stem, status)
    values ('cc000000-0000-0000-0000-000000000001',
            'cd000000-0000-0000-0000-000000000001', 'Mine', 'active')$$);
-- Denied at the GRANT, not merely filtered to zero rows by RLS. The
-- distinction matters: a zero-row update means the privilege exists and the
-- policy happened to match nothing, which is one policy edit away from
-- working. No grant at all is the stronger statement, and it is what the
-- migration actually does -- students are granted SELECT only.
select pg_temp.check_denied('B9  A student cannot update a question',
  $$update public.questions set stem = 'tampered'$$);
select pg_temp.check_denied('B10 A student cannot delete a question',
  'delete from public.questions');

-- ===========================================================================
-- C. A STUDENT CANNOT MARK THEIR OWN PAPER
-- ===========================================================================
insert into public.attempts
  (id, student_id, course_id, kind, reveal, question_count)
values ('da000000-0000-0000-0000-000000000001',
        'a1111111-1111-1111-1111-111111111111',
        'cc000000-0000-0000-0000-000000000001', 'mock', 'on_submit', 1);

insert into public.attempt_questions
  (attempt_id, student_id, question_id, position)
values ('da000000-0000-0000-0000-000000000001',
        'a1111111-1111-1111-1111-111111111111',
        'ce000000-0000-0000-0000-000000000001', 1);

select pg_temp.check_eq('C1  is_correct starts NULL — nothing to read mid-attempt',
  (select is_correct from public.attempt_questions
    where attempt_id = 'da000000-0000-0000-0000-000000000001'), null::boolean);

-- THE ONE-BIT LEAK. If a student can write is_correct, they can also write
-- it speculatively and read back whether it stuck.
--
-- This is REJECTED rather than filtered to zero rows, and the difference is
-- worth stating: the row is the student's own and the attempt is open, so the
-- policy's USING clause admits it -- and then the WITH CHECK refuses the new
-- value. A silent zero-row update would leave the caller unsure whether the
-- write was blocked or simply matched nothing; an error is unambiguous.
select pg_temp.check_denied('C2  A student cannot set is_correct themselves',
  $$update public.attempt_questions set is_correct = true
     where attempt_id = 'da000000-0000-0000-0000-000000000001'$$);

-- Again denied at the grant: attempts carry SELECT and INSERT for students,
-- never UPDATE. Scoring happens inside score_attempt(), which runs as the
-- owner and is unaffected by this.
select pg_temp.check_denied('C3  A student cannot write their own score',
  $$update public.attempts set correct_count = 1, submitted_at = now()
     where id = 'da000000-0000-0000-0000-000000000001'$$);

select pg_temp.check_denied('C4  A student cannot delete a bad attempt',
  $$delete from public.attempts
     where id = 'da000000-0000-0000-0000-000000000001'$$);

-- Answering is allowed. This is the one write a student legitimately makes.
select pg_temp.check_affects('C5  A student CAN record an answer',
  $$update public.attempt_questions
       set selected_option_id = 'cf000000-0000-0000-0000-000000000001',
           answered_at = now()
     where attempt_id = 'da000000-0000-0000-0000-000000000001'$$, 1);

select pg_temp.check_eq('C6  ...and is_correct is STILL null after answering',
  (select is_correct from public.attempt_questions
    where attempt_id = 'da000000-0000-0000-0000-000000000001'), null::boolean);

reset role;
-- ===========================================================================
-- D. SCORING — the SECURITY DEFINER function does its own authorisation
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

-- The whole risk of a definer function in one assertion: it runs with owner
-- rights, so if it does not check WHO is calling, anybody can submit anybody's
-- paper -- or farm it for answers by submitting attempts they constructed.
select pg_temp.check_denied('D1  A stranger cannot score someone else''s attempt',
  $$select * from public.score_attempt('da000000-0000-0000-0000-000000000001')$$);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.check_eq('D2  The owner scores it, and the answer was right',
  (select correct_count from public.score_attempt(
     'da000000-0000-0000-0000-000000000001')), 1);

select pg_temp.check_eq('D3  ...the attempt is now marked submitted',
  (select submitted_at is not null from public.attempts
    where id = 'da000000-0000-0000-0000-000000000001'), true);

select pg_temp.check_eq('D4  ...and is_correct is finally readable',
  (select is_correct from public.attempt_questions
    where attempt_id = 'da000000-0000-0000-0000-000000000001'), true);

-- Re-scoring would let a student submit, see the mark, change the answer and
-- submit again -- which is the answer key, delivered slowly.
select pg_temp.check_denied('D5  An attempt cannot be scored twice',
  $$select * from public.score_attempt('da000000-0000-0000-0000-000000000001')$$);

select pg_temp.check_affects('D6  ...and answers cannot be changed after submission',
  $$update public.attempt_questions
       set selected_option_id = 'cf000000-0000-0000-0000-000000000002'
     where attempt_id = 'da000000-0000-0000-0000-000000000001'$$, 0);

-- Unanswered means wrong, not excluded. Otherwise a student answers only what
-- they are sure of and reports 100%.
insert into public.attempts
  (id, student_id, course_id, kind, reveal, topic_id, question_count)
values ('da000000-0000-0000-0000-000000000002',
        'a1111111-1111-1111-1111-111111111111',
        'cc000000-0000-0000-0000-000000000001', 'drill', 'immediate',
        'cd000000-0000-0000-0000-000000000001', 1);
insert into public.attempt_questions
  (attempt_id, student_id, question_id, position)
values ('da000000-0000-0000-0000-000000000002',
        'a1111111-1111-1111-1111-111111111111',
        'ce000000-0000-0000-0000-000000000001', 1);

select pg_temp.check_eq('D7  An unanswered question scores as wrong, not skipped',
  (select correct_count from public.score_attempt(
     'da000000-0000-0000-0000-000000000002')), 0);

reset role;

-- ===========================================================================
-- E. THE CONSTRAINTS THAT KEEP READINESS MEANINGFUL
-- ===========================================================================

-- A mock with instant feedback is not a measurement, and readiness is
-- computed from mocks. Enforced in the schema so no client can opt out.
select pg_temp.check_error('E1  A mock cannot use immediate reveal',
  $$insert into public.attempts
      (student_id, course_id, kind, reveal, question_count)
    values ('a1111111-1111-1111-1111-111111111111',
            'cc000000-0000-0000-0000-000000000001', 'mock', 'immediate', 130)$$,
  '23514');

select pg_temp.check_error('E2  A drill must name the topic it drills',
  $$insert into public.attempts
      (student_id, course_id, kind, reveal, question_count)
    values ('a1111111-1111-1111-1111-111111111111',
            'cc000000-0000-0000-0000-000000000001', 'drill', 'immediate', 10)$$,
  '23514');

select pg_temp.check_error('E3  An attempt cannot be created already scored',
  $$insert into public.attempts
      (student_id, course_id, kind, reveal, question_count, correct_count)
    values ('a1111111-1111-1111-1111-111111111111',
            'cc000000-0000-0000-0000-000000000001', 'quiz', 'immediate', 5, 5)$$,
  '23514');

-- An answer key pointing at another question's option would mark every
-- attempt wrong, with nothing in the schema objecting.
select pg_temp.check_error('E4  An answer key cannot point at another question''s option',
  $$insert into public.question_answers (question_id, course_id, correct_option_id)
    values ('ce000000-0000-0000-0000-000000000001',
            'cc000000-0000-0000-0000-000000000001',
            'cf000000-0000-0000-0000-000000000003')$$,
  '23505');

rollback;
