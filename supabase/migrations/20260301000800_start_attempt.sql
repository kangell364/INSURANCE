-- Drawing a paper, server-side.
--
-- public.start_attempt(course, kind, lesson, module, topic, reveal) -> uuid
--
-- SECURITY DEFINER, and the THIRD in this project. The Phase 1 post-mortem
-- established that definer rights must be justified, not assumed, so here is
-- the justification and the alternative that was rejected.
--
-- THE HOLE THIS CLOSES
--
-- Until now a student held `insert` on attempt_questions, and RLS checked
-- only that the attempt was theirs. Nothing checked WHICH questions went in,
-- or HOW MANY. A student could insert five easy questions, label the attempt
-- a mock, score 100% -- and readiness is computed from mock attempts, so they
-- would be moving their own readiness figure. Every other part of this design
-- refuses to trust the client with scoring; the draw was the step that still
-- did.
--
-- WHY DEFINER RIGHTS
--
-- The fix is to revoke insert on attempt_questions (done below) and let the
-- paper be assembled only here. Once that insert is revoked, an INVOKER
-- function running as the student cannot insert either. Definer rights are
-- exactly the mechanism for "let the caller cause something they cannot do
-- themselves" -- the same justification as score_attempt().
--
-- The obligations that come with it, all discharged below:
--   1. Verify the caller is enrolled in the course, FIRST.
--   2. Never select an unpublished question, so the review gate holds here
--      too. A draft question is one nobody has checked the answer key of.
--   3. Never return, or expose, a correct option id. This function returns
--      an attempt id and nothing else.
--   4. search_path pinned.
--
-- SHORT DRAWS ARE HONEST
--
-- If a topic has fewer published questions than the blueprint asks for, the
-- paper is short and question_count records what was actually drawn. It does
-- not top up from another topic: a paper that quietly over-weights whatever
-- happens to be written is a worse lie than a short paper that admits it.
-- The caller compares question_count against the blueprint to tell the
-- student.

create or replace function public.start_attempt(
  p_course_id uuid,
  p_kind      public.attempt_kind,
  p_lesson_id uuid default null,
  p_module_id uuid default null,
  p_topic_id  uuid default null,
  p_reveal    public.reveal_mode default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := (select auth.uid());
  v_attempt uuid;
  v_reveal  public.reveal_mode;
  v_drawn   integer;
begin
  -- (1) Authorisation, before anything else. As a definer function this
  -- bypasses RLS, so this test IS the access control.
  if v_student is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.enrollments e
     where e.student_id = v_student
       and e.course_id  = p_course_id
       and e.status     = 'active'::public.enrollment_status
       and (e.expires_at is null or e.expires_at > now())
  ) then
    raise exception 'not enrolled in this course'
      using errcode = 'insufficient_privilege';
  end if;

  -- A mock and a module test are measurements; the constraints on `attempts`
  -- already refuse anything else, but defaulting here means a caller cannot
  -- get a confusing constraint error for a choice they did not make.
  v_reveal := coalesce(
    case when p_kind in ('mock'::public.attempt_kind, 'module'::public.attempt_kind)
         then 'on_submit'::public.reveal_mode else p_reveal end,
    case when p_kind in ('mock'::public.attempt_kind, 'module'::public.attempt_kind)
         then 'on_submit'::public.reveal_mode else 'immediate'::public.reveal_mode end
  );

  insert into public.attempts
    (student_id, course_id, kind, reveal, lesson_id, module_id, topic_id, question_count)
  values
    (v_student, p_course_id, p_kind, v_reveal,
     case when p_kind = 'quiz'::public.attempt_kind   then p_lesson_id end,
     case when p_kind = 'module'::public.attempt_kind then p_module_id end,
     case when p_kind = 'drill'::public.attempt_kind  then p_topic_id  end,
     1)                      -- provisional; rewritten once the draw is known
  returning id into v_attempt;

  -- (2) The draw. Every branch filters on status = 'active', so the review
  -- gate that keeps a draft question away from a student holds here as well.
  if p_kind = 'mock'::public.attempt_kind then
    -- Blueprint-weighted: topics.question_count per topic, counts not
    -- percentages, so eight roundings cannot miss the total.
    insert into public.attempt_questions (attempt_id, student_id, question_id, position)
    select v_attempt, v_student, q.id, row_number() over (order by t.code, random())
      from public.topics t
      join lateral (
        select q.id
          from public.questions q
         where q.topic_id = t.id
           and q.status = 'active'::public.content_status
         order by random()
         limit coalesce(t.question_count, 0)
      ) q on true
     where t.course_id = p_course_id;

  elsif p_kind = 'quiz'::public.attempt_kind then
    -- Every published question for the lesson just read, minus any reserved
    -- for mocks. A quiz is a check on comprehension, so it is exhaustive.
    insert into public.attempt_questions (attempt_id, student_id, question_id, position)
    select v_attempt, v_student, q.id, row_number() over (order by random())
      from public.questions q
     where q.lesson_id = p_lesson_id
       and q.status = 'active'::public.content_status
       and not q.mock_only;

  elsif p_kind = 'module'::public.attempt_kind then
    -- Thirty across the module's lessons. Module 2 holds 100 questions; a
    -- test that used all of them would take two hours and nobody would
    -- finish it.
    insert into public.attempt_questions (attempt_id, student_id, question_id, position)
    select v_attempt, v_student, q.id, row_number() over (order by random())
      from public.questions q
      join public.lessons l on l.id = q.lesson_id
     where l.module_id = p_module_id
       and q.status = 'active'::public.content_status
       and not q.mock_only
     order by random()
     limit 30;

  elsif p_kind = 'drill'::public.attempt_kind then
    -- Remediation on one blueprint topic, offered after a bad topic score.
    insert into public.attempt_questions (attempt_id, student_id, question_id, position)
    select v_attempt, v_student, q.id, row_number() over (order by random())
      from public.questions q
     where q.topic_id = p_topic_id
       and q.status = 'active'::public.content_status
       and not q.mock_only
     order by random()
     limit 20;
  end if;

  select count(*) into v_drawn
    from public.attempt_questions aq where aq.attempt_id = v_attempt;

  -- An empty draw is not a paper. It happens when nothing in scope has been
  -- reviewed yet, and returning an attempt with no questions would show the
  -- student a blank exam rather than an explanation.
  if v_drawn = 0 then
    delete from public.attempts a where a.id = v_attempt;
    raise exception 'no published questions available for this selection'
      using errcode = 'no_data_found';
  end if;

  update public.attempts a set question_count = v_drawn where a.id = v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.start_attempt(uuid, public.attempt_kind, uuid, uuid, uuid, public.reveal_mode) from public, anon;
grant execute on function public.start_attempt(uuid, public.attempt_kind, uuid, uuid, uuid, public.reveal_mode) to authenticated;

comment on function public.start_attempt(uuid, public.attempt_kind, uuid, uuid, uuid, public.reveal_mode) is
  'Assembles a paper server-side and returns the attempt id. SECURITY DEFINER '
  'because the caller may no longer insert into attempt_questions; see the '
  'migration header for why that insert was revoked.';

-- THE REVOKE THAT MAKES THE ABOVE MEAN ANYTHING.
--
-- Without this, start_attempt() is merely a convenience and a student can
-- still hand-build a paper. Update stays: answering a question is an update
-- to selected_option_id, and attempt_questions_update_own_unsubmitted already
-- confines that to their own unsubmitted attempt.
revoke insert on table public.attempt_questions from authenticated;

drop policy if exists attempt_questions_insert_own on public.attempt_questions;

-- And the same for attempts itself. Leaving it would not be exploitable --
-- an attempt with no questions scores zero, which hurts the student who made
-- it -- but a half-closed door invites somebody to assume the other half is
-- open too. start_attempt() creates the attempt row; nothing else needs to.
revoke insert on table public.attempts from authenticated;

drop policy if exists attempts_insert_own on public.attempts;
