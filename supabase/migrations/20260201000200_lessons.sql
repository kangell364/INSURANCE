-- ===========================================================================
-- Phase 2 / 03 — lessons and lesson_contents
--
-- THE SPLIT, AND WHY IT EXISTS
--
-- A lesson has two halves with genuinely different audiences:
--
--   * Its METADATA -- title, slug, position, estimated_minutes -- is the
--     public syllabus. It is what a prospective student reads before paying,
--     and what a search engine indexes. It must be visible to anonymous
--     visitors.
--
--   * Its BODY is the product. It must be visible only to a student with a
--     live enrollment in the course.
--
-- Those two rules cannot both be applied to one row. RLS decides which ROWS a
-- caller sees; column-level GRANTs decide which COLUMNS a ROLE may touch.
-- Neither can express "this role may read these columns of this row but not
-- those columns of the same row" -- an anonymous visitor and an enrolled
-- student both connect as a database role (anon / authenticated), and the
-- enrolled student's privilege is a property of their enrollment row, not of
-- their role. A single `lessons.body` column therefore has no correct grant:
-- granting it hands the course to anonymous visitors, revoking it hides the
-- course from the students who paid for it.
--
-- So the body lives in its own table, public.lesson_contents, with its own
-- policy. This is the same reasoning that puts the answer key in
-- question_answers rather than in a column of question_options
-- (docs/phase-2-design.md, section 1): when a thing is secret, making it a
-- separate table means the grant surface is a whole table that nobody widens
-- by accident, rather than a column somebody has to remember to exclude from
-- `select=*`.
-- ===========================================================================

create table public.lessons (
  id         uuid not null default gen_random_uuid(),
  module_id  uuid not null,

  -- Denormalised from modules.course_id, and PROVABLY consistent with it.
  --
  -- The composite foreign key below points at modules (id, course_id), so
  -- PostgreSQL itself refuses any row whose course_id disagrees with its
  -- module's. `on update cascade` means moving a module to another course
  -- rewrites its lessons' course_id in the same statement rather than
  -- breaking the reference.
  --
  -- This is worth one redundant column. Without it, every enrollment check in
  -- an RLS policy -- "may this caller read this lesson's body?" -- has to join
  -- lessons to modules to reach a course id, on every row, inside a policy
  -- that is evaluated for every row scanned. With it, the policy reads one
  -- column. The usual objection to denormalisation is that the copy drifts
  -- from the original; a composite foreign key is exactly the mechanism that
  -- makes drift impossible, so the objection does not apply here.
  course_id  uuid not null,

  title      text not null,
  slug       text not null,
  summary    text,
  position   integer not null,
  status     public.content_status not null default 'draft',
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lessons_pkey primary key (id),

  constraint lessons_module_fkey
    foreign key (module_id, course_id)
    references public.modules (id, course_id)
    on update cascade
    on delete cascade,

  constraint lessons_title_length check (char_length(title) between 1 and 200),
  constraint lessons_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint lessons_slug_length check (char_length(slug) between 1 and 120),
  constraint lessons_position_positive check (position > 0),
  constraint lessons_estimated_minutes_sane
    check (estimated_minutes is null or estimated_minutes between 1 and 600),

  -- Readable URLs: /courses/:courseSlug/:moduleSlug-ish/:lessonSlug. Unique
  -- per module rather than per course, so "introduction" can appear once in
  -- each module without the author inventing disambiguating names.
  constraint lessons_module_slug_key unique (module_id, slug),

  -- Deferrable for the same reordering reason as modules.position.
  constraint lessons_module_position_key unique (module_id, position)
    deferrable initially immediate,

  -- FK target for lesson_contents and lesson_topics, both of which carry
  -- course_id for the same policy-performance reason as above.
  constraint lessons_id_course_key unique (id, course_id)
);

comment on table public.lessons is
  'Lesson METADATA only -- the public syllabus. The body lives in '
  'public.lesson_contents, which is readable only by enrolled students.';

comment on column public.lessons.course_id is
  'Denormalised from modules.course_id and held consistent by the composite '
  'foreign key lessons_module_fkey. Do not set it independently.';

comment on column public.lessons.summary is
  'One or two sentences shown in the syllabus. PUBLIC -- never put exam '
  'content or answers here.';

create index lessons_module_position_idx
  on public.lessons (module_id, position);

create index lessons_course_id_idx on public.lessons (course_id);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lesson_contents — the paid half.
-- ---------------------------------------------------------------------------
create table public.lesson_contents (
  lesson_id  uuid not null,

  -- Same denormalisation, same composite-FK guarantee, same reason: the
  -- enrollment check in this table's RLS policy is the hottest policy in the
  -- application and should not have to join two tables to find a course id.
  course_id  uuid not null,

  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lesson_contents_pkey primary key (lesson_id),

  constraint lesson_contents_lesson_fkey
    foreign key (lesson_id, course_id)
    references public.lessons (id, course_id)
    on update cascade
    on delete cascade
);

comment on table public.lesson_contents is
  'Lesson bodies. Markdown (decision A, docs/phase-2-design.md). Readable '
  'only by an admin or a student with a live enrollment in course_id. No '
  'grants at all to anon.';

comment on column public.lesson_contents.body is
  'Markdown. Rendered server-side through a sanitising pipeline -- raw HTML '
  'is not honoured, because an instructor account is not a reason to allow '
  'arbitrary markup into another user''s browser.';

create index lesson_contents_course_id_idx on public.lesson_contents (course_id);

create trigger lesson_contents_set_updated_at
  before update on public.lesson_contents
  for each row execute function public.set_updated_at();
