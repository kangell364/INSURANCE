-- Questions and their options.
--
-- THE CORRECT ANSWER IS NOT IN EITHER OF THESE TABLES. It lives in
-- question_answers, which no browser role may read. See
-- docs/phase-3-design.md.

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,

  -- Which blueprint topic this question tests. Required: a question that is
  -- not tagged cannot be drawn into a paper, so an untagged question is a
  -- question that does not exist as far as the product is concerned.
  topic_id    uuid not null,

  -- The lesson this question follows from, where there is one. Nullable
  -- because a mock question need not belong to any single lesson.
  lesson_id   uuid,

  stem        text not null,

  -- Shown only once the answer may be revealed. This is where the teaching
  -- happens: "the policy pays $74,000 because coinsurance applies before the
  -- deductible" is worth more than the mark.
  explanation text,

  status      public.content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- The composite foreign keys make the denormalised course_id provably
  -- consistent with the parents, rather than consistent by convention and a
  -- trigger. They also make it structurally impossible to tag a question with
  -- a topic from another course.
  constraint questions_topic_fk
    foreign key (topic_id, course_id)
    references public.topics (id, course_id) on delete cascade,
  constraint questions_lesson_fk
    foreign key (lesson_id, course_id)
    references public.lessons (id, course_id) on delete set null,

  constraint questions_stem_not_blank check (btrim(stem) <> ''),
  constraint questions_id_course_key unique (id, course_id)
);

create index questions_course_topic_idx
  on public.questions (course_id, topic_id) where status = 'active';
create index questions_lesson_idx on public.questions (lesson_id);

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  course_id   uuid not null references public.courses (id) on delete cascade,
  body        text not null,

  -- Display order. NOT the answer: option 1 is no more likely to be correct
  -- than option 4, and nothing in the schema encodes otherwise.
  position    integer not null,

  constraint question_options_question_fk
    foreign key (question_id, course_id)
    references public.questions (id, course_id) on delete cascade,
  constraint question_options_body_not_blank check (btrim(body) <> ''),
  constraint question_options_position_positive check (position between 1 and 10),
  constraint question_options_question_position_key unique (question_id, position),
  constraint question_options_id_question_key unique (id, question_id)
);

create index question_options_question_idx
  on public.question_options (question_id, position);

comment on table public.questions is
  'Question stems. The correct answer is NOT here; see question_answers.';
comment on table public.question_options is
  'The options a student picks between. Deliberately carries no is_correct '
  'column: RLS filters rows and grants filter columns, and neither can hide '
  'one column of a row the caller is otherwise allowed to read. The answer '
  'therefore lives in a different table with different grants.';
