-- ===========================================================================
-- Phase 1 / 07 — Row-Level Security
--
-- RLS is enabled on every table in `public`. There is no "we'll add policies
-- later" table: a table with RLS on and no policy denies everything, which is
-- the correct default.
--
-- `(select auth.uid())` is wrapped in a scalar subquery throughout. Postgres
-- then evaluates it once per statement instead of once per row, which is the
-- pattern Supabase recommends for policy performance.
-- ===========================================================================

alter table public.profiles    enable row level security;
alter table public.courses     enable row level security;
alter table public.enrollments enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- A user can read exactly one profile: their own.
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Admins can read every profile (the Phase 2 student roster needs this).
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- A user can update their own row. Which COLUMNS they may touch is decided by
-- the column-level GRANT (first_name, last_name only) and enforced a second
-- time by public.enforce_profile_immutable_columns().
--
-- The WITH CHECK clause prevents re-parenting the row onto another user id.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deliberately absent:
--   * INSERT — profiles come from the auth.users trigger only.
--   * DELETE — profiles are removed by cascade from auth.users.
--   * any policy for `anon`.

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

-- Active courses are the public catalog: titles and marketing descriptions,
-- no student data. Readable signed-in or not so that /courses works for
-- visitors. Draft and archived courses are invisible to everyone but admins.
create policy courses_select_active
  on public.courses
  for select
  to anon, authenticated
  using (status = 'active'::public.course_status);

create policy courses_select_admin
  on public.courses
  for select
  to authenticated
  using (public.is_admin());

create policy courses_insert_admin
  on public.courses
  for insert
  to authenticated
  with check (public.is_admin());

create policy courses_update_admin
  on public.courses
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy courses_delete_admin
  on public.courses
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------

-- A student sees only their own enrollments.
create policy enrollments_select_own
  on public.enrollments
  for select
  to authenticated
  using (student_id = (select auth.uid()));

create policy enrollments_select_admin
  on public.enrollments
  for select
  to authenticated
  using (public.is_admin());

-- Students CANNOT self-enroll in Phase 1. There is intentionally no INSERT,
-- UPDATE or DELETE policy for the student case: enrollment will be granted by
-- the checkout / admin flows in a later phase, where it can be tied to a
-- payment or an explicit administrative action. Adding a permissive student
-- INSERT policy now would let anyone grant themselves free access to every
-- course.
create policy enrollments_insert_admin
  on public.enrollments
  for insert
  to authenticated
  with check (public.is_admin());

create policy enrollments_update_admin
  on public.enrollments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy enrollments_delete_admin
  on public.enrollments
  for delete
  to authenticated
  using (public.is_admin());
