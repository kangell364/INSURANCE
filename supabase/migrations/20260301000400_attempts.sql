-- Attempts: one student sitting one paper.

create table public.attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,

  kind         public.attempt_kind not null,
  reveal       public.reveal_mode  not null,

  -- The topic a drill is confined to, and the lesson a quiz follows. Both
  -- null for a mock, which spans everything.
  topic_id     uuid,
  lesson_id    uuid,

  started_at   timestamptz not null default now(),
  submitted_at timestamptz,

  -- Written only at submission, by score_attempt(). Null on an attempt in
  -- progress, which is also how "has this been scored?" is answered.
  correct_count  integer,
  question_count integer not null,

  -- Stamped so a stored result keeps the meaning it had when it was made.
  -- If READY_THRESHOLD ever moves, old attempts are not silently
  -- reinterpreted against the new bar.
  scale_version  integer not null default 1,

  -- A mock is ALWAYS revealed at the end. Enforced here rather than in the
  -- UI because readiness is computed from mock attempts: if the client could
  -- choose, the readiness figure would quietly change meaning depending on a
  -- radio button the student ticked.
  constraint attempts_mock_is_on_submit check (
    kind <> 'mock'::public.attempt_kind
    or reveal = 'on_submit'::public.reveal_mode
  ),

  -- A drill is about one topic; a mock is about all of them.
  constraint attempts_drill_has_topic check (
    (kind = 'drill'::public.attempt_kind) = (topic_id is not null)
  ),
  constraint attempts_mock_has_no_lesson check (
    kind <> 'mock'::public.attempt_kind or lesson_id is null
  ),

  constraint attempts_question_count_positive check (question_count between 1 and 200),
  constraint attempts_correct_within_total check (
    correct_count is null
    or correct_count between 0 and question_count
  ),
  -- A score without a submission, or a submission without a score, is a
  -- half-written attempt. Neither is a state the reader should have to handle.
  constraint attempts_scored_iff_submitted check (
    (submitted_at is null) = (correct_count is null)
  ),

  constraint attempts_topic_fk foreign key (topic_id, course_id)
    references public.topics (id, course_id) on delete cascade,
  constraint attempts_lesson_fk foreign key (lesson_id, course_id)
    references public.lessons (id, course_id) on delete set null,
  constraint attempts_id_student_key unique (id, student_id)
);

create index attempts_student_recent_idx
  on public.attempts (student_id, course_id, submitted_at desc nulls last);

-- ---------------------------------------------------------------------------

create table public.attempt_questions (
  attempt_id         uuid not null,
  student_id         uuid not null,
  question_id        uuid not null references public.questions (id) on delete cascade,
  position           integer not null,

  selected_option_id uuid references public.question_options (id) on delete set null,
  answered_at        timestamptz,

  -- THE ONE-BIT LEAK.
  --
  -- This column IS the answer, disclosed one question at a time. A student
  -- who answers, reads is_correct, and reconsiders has defeated the entire
  -- design -- the answer key stayed secret and told them anyway.
  --
  -- So it stays NULL until the reveal is allowed: written at submission for
  -- a mock or an on_submit attempt, and per answer only in immediate mode,
  -- where showing it is the whole point. score_attempt() is what writes it;
  -- nothing else may.
  is_correct         boolean,

  primary key (attempt_id, question_id),

  constraint attempt_questions_attempt_fk
    foreign key (attempt_id, student_id)
    references public.attempts (id, student_id) on delete cascade,
  constraint attempt_questions_position_positive check (position between 1 and 200),
  constraint attempt_questions_answered_iff_selected check (
    (selected_option_id is null) = (answered_at is null)
  ),
  constraint attempt_questions_attempt_position_key unique (attempt_id, position)
);

create index attempt_questions_question_idx
  on public.attempt_questions (question_id);

comment on column public.attempt_questions.is_correct is
  'Null until the answer may be revealed. Written by score_attempt() only. '
  'Populating it earlier would leak the answer key one bit at a time.';
