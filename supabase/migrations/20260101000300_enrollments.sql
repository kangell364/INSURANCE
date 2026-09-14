-- ===========================================================================
-- Phase 1 / 04 — enrollments
--
-- Join row between a student profile and a course.
-- ===========================================================================

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete restrict,
  status      public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  expires_at  timestamptz,

  -- One enrollment row per student per course.
  --
  -- Rationale: the dashboard, progress tracking and (in later phases) exam
  -- eligibility all answer "is this student enrolled in this course?". A
  -- second row makes that question ambiguous and invites accidental duplicate
  -- billing. Re-enrolling a lapsed student updates the existing row's status
  -- and expires_at rather than inserting a new one. If Phase 3+ needs a full
  -- purchase history, that belongs in a separate immutable `orders` table, not
  -- in duplicated enrollment rows.
  constraint enrollments_student_course_key unique (student_id, course_id),

  constraint enrollments_expires_after_enrolled check (
    expires_at is null or expires_at > enrolled_at
  )
);

comment on table public.enrollments is
  'Student <-> course membership. Students may read only their own rows and '
  'cannot self-enroll in Phase 1.';

-- `on delete restrict` on course_id: deleting a course that students are
-- enrolled in would silently destroy their access record. Archive the course
-- (status = archived) instead.

create index enrollments_student_id_idx on public.enrollments (student_id);
create index enrollments_course_id_idx on public.enrollments (course_id);
create index enrollments_student_status_idx
  on public.enrollments (student_id, status);
