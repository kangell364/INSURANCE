-- The module tier, and the holdout flag.
--
-- The course teaches in three widening passes: a quiz after each lesson, a
-- test after each module, then a full mock. `attempts` could express the
-- first and the last -- lesson_id for a quiz, both null for a mock -- but had
-- no way to say "this attempt covers Module 3". This adds it.
--
-- The 'module' value of attempt_kind is added by the migration before this
-- one and MUST stay there: PostgreSQL will not let a new enum value be used
-- in the transaction that created it, and the checks below use it.
--
-- WHY A HOLDOUT FLAG SHIPS EMPTY
--
-- With a quiz after every lesson and a test after every module, a student has
-- seen almost every question in the bank before their first mock. The mock
-- then measures how well they remember our questions, not how well they know
-- insurance -- and readiness is computed from mocks.
--
-- The real fix is more questions, written mock-only. That is content work, not
-- schema work. The column exists now so that adding them later is a data
-- change rather than a migration against live attempt history, and so the
-- draw can already honour it. It is false everywhere until such questions
-- exist, and the results screen discloses how many questions the student had
-- seen before rather than pretending the number means more than it does.

alter table public.questions
  add column if not exists mock_only boolean not null default false;

comment on column public.questions.mock_only is
  'Reserved for mock papers: never drawn into a quiz, module test or drill. '
  'Empty until mock-only questions are written; see the migration header.';

alter table public.attempts
  add column if not exists module_id uuid;

-- Composite, against (id, course_id), for the same reason every other
-- reference in this schema is: it makes the denormalised course_id provably
-- consistent and makes a cross-course attempt structurally impossible.
alter table public.attempts
  add constraint attempts_module_fk foreign key (module_id, course_id)
    references public.modules (id, course_id) on delete set null;

-- Each kind names its own scope, and only its own.
--
--   quiz   -> lesson_id           a check on the lesson just read
--   module -> module_id           a test over the module just finished
--   drill  -> topic_id            remediation on one blueprint topic
--   mock   -> none                the whole blueprint
--
-- attempts_drill_has_topic already pins the drill case. These pin the rest,
-- so an attempt cannot claim to be a module test while carrying a lesson, or
-- a module test with no module at all.
alter table public.attempts
  add constraint attempts_module_has_module check (
    (kind = 'module'::public.attempt_kind) = (module_id is not null)
  );

alter table public.attempts
  add constraint attempts_quiz_has_lesson check (
    kind <> 'quiz'::public.attempt_kind or lesson_id is not null
  );

-- A module test is a measurement, like a mock. Immediate feedback would turn
-- it into a guided walk through the answers, which is what the lesson quiz is
-- already for.
alter table public.attempts
  add constraint attempts_module_is_on_submit check (
    kind <> 'module'::public.attempt_kind
    or reveal = 'on_submit'::public.reveal_mode
  );

create index if not exists attempts_module_idx
  on public.attempts (student_id, module_id)
  where module_id is not null;
