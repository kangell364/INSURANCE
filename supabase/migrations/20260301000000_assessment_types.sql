-- Phase 3 enums.
--
-- Kept separate from content_status and course_status for the same reason
-- those were kept apart from each other: a question's lifecycle and a course's
-- lifecycle are different things that happen to share vocabulary today, and
-- merging them means every future value added for one is silently offered to
-- the other.

-- How a student is practising. This drives the draw, the reveal rule and
-- whether the attempt counts toward readiness.
create type public.attempt_kind as enum (
  'mock',   -- 130 scored questions to the blueprint's counts; the measurement
  'quiz',   -- a handful on one lesson's topic
  'drill'   -- one topic, as many as asked for
);

-- When the student is allowed to learn whether they were right.
create type public.reveal_mode as enum (
  'immediate',  -- after each answer; study, not measurement
  'on_submit'   -- after the whole attempt, like the real exam
);

comment on type public.attempt_kind is
  'mock/quiz/drill. Only mock counts toward readiness, and only mock is drawn '
  'to the published blueprint counts.';

comment on type public.reveal_mode is
  'When is_correct may be written and read. A mock is always on_submit, '
  'enforced by a check constraint on attempts, because a mock scored with '
  'instant feedback measures nothing.';
