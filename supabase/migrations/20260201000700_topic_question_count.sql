-- ===========================================================================
-- Phase 2 / 08 — topics.question_count
--
-- WHY THIS COLUMN EXISTS, having shipped `blueprint_weight` first.
--
-- `blueprint_weight` was added on the assumption that an examination
-- blueprint publishes percentages. The Texas one does not. Pearson VUE
-- publication 124401, "Texas Insurance Content Outlines", assigns each
-- section a NUMBER OF SCOREABLE QUESTIONS:
--
--     I.   TYPES OF POLICIES ............................ 22
--     II.  INSURANCE TERMS AND RELATED CONCEPTS ......... 15
--     ...
--
-- Storing those as percentages would be lossy in both directions. 22 of 130
-- is 16.923…%, so the primary figure cannot be recovered from a
-- numeric(5,2); and a Phase 3 paper generator asked to build a practice exam
-- needs "draw 22 questions from this topic", not a percentage it must
-- multiply and round back into an integer — where the rounding of eight
-- sections can easily miss the exam length by one or two questions.
--
-- So the count is stored as published and the percentage is DERIVED for
-- display. `blueprint_weight` is kept rather than dropped: other states and
-- other lines do publish percentage-weighted blueprints, and this schema is
-- meant to outlive one exam.
--
-- Precedence, applied consistently in the UI: when `question_count` is
-- present it is the authority and any percentage shown is computed from it.
-- `blueprint_weight` is used only when no count exists.
-- ===========================================================================

alter table public.topics
  add column question_count integer;

comment on column public.topics.question_count is
  'Scoreable questions the published blueprint assigns to this topic. The '
  'primary figure where the blueprint gives counts (Texas does). Percentages '
  'shown to users are derived from this, never stored.';

comment on column public.topics.blueprint_weight is
  'Published percentage weighting, for blueprints expressed that way. Ignored '
  'when question_count is set. Texas publishes counts, so this is null there.';

alter table public.topics
  add constraint topics_question_count_positive
  check (question_count is null or question_count between 1 and 500);
