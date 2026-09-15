-- ===========================================================================
-- Phase 2 / 05 — Content privileges and the helpers the policies need.
--
-- Supabase's defaults hand `anon` and `authenticated` full privileges on every
-- new table in `public`. Every table below therefore starts with a blanket
-- REVOKE and is then granted narrowly, exactly as Phase 1 does for profiles.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- public.is_enrolled_in_course(uuid) -> boolean
--
-- SECURITY INVOKER, deliberately.
--
-- The Phase 1 post-mortem was that SECURITY DEFINER had been used reflexively,
-- on a function that did not need it, and that the rebinding it causes made a
-- security trigger a silent no-op. The rule adopted afterwards is that
-- SECURITY DEFINER must be justified, not assumed. It is not justified here:
-- this function reads the caller's OWN enrollment rows, which the caller is
-- already permitted to read under the Phase 1 policy enrollments_select_own.
-- Running it as the owner would add privilege the function has no use for, and
-- would mean a bug in the WHERE clause leaks other students' enrollments
-- instead of returning nothing.
--
-- As an invoker-rights function it is doubly constrained: the WHERE clause
-- filters to auth.uid(), and RLS on enrollments would filter to the same rows
-- even if that clause were deleted.
--
-- Note it is NOT granted to `anon`. Anonymous visitors have no privilege on
-- enrollments at all, so calling it as anon would raise rather than return
-- false -- which is why no anon-facing policy references it.
-- ---------------------------------------------------------------------------
create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.enrollments e
     where e.student_id = (select auth.uid())
       and e.course_id = p_course_id
       and e.status = 'active'::public.enrollment_status
       and (e.expires_at is null or e.expires_at > now())
  );
$$;

comment on function public.is_enrolled_in_course(uuid) is
  'True when the current user holds a live (active, unexpired) enrollment in '
  'the given course. SECURITY INVOKER: it reads only the caller''s own rows.';

revoke all on function public.is_enrolled_in_course(uuid) from public;
grant execute on function public.is_enrolled_in_course(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.lesson_is_published(uuid) -> boolean
--
-- A lesson is published only if its module is published and its course is
-- active. Checking the whole chain matters: unpublishing a module must hide
-- its lessons, and archiving a course must hide everything under it, without
-- anyone having to remember to cascade a status change by hand.
--
-- The status tests are written out explicitly rather than inferred from
-- whether the row is visible to the caller. Relying on another table's policy
-- to do the filtering would make this function's meaning depend on a policy in
-- a different migration -- correct today, quietly wrong the first time that
-- policy is edited.
--
-- SECURITY INVOKER again: every table it touches is one the caller may already
-- read, so it needs nothing extra.
-- ---------------------------------------------------------------------------
create or replace function public.lesson_is_published(p_lesson_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = l.course_id
     where l.id = p_lesson_id
       and l.status = 'active'::public.content_status
       and m.status = 'active'::public.content_status
       and c.status = 'active'::public.course_status
  );
$$;

comment on function public.lesson_is_published(uuid) is
  'True when a lesson, its module and its course are all published.';

revoke all on function public.lesson_is_published(uuid) from public;
grant execute on function public.lesson_is_published(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Table privileges.
--
-- The write grants below are inert for ordinary users: there is no non-admin
-- write policy on any of these tables, and RLS can only narrow a privilege,
-- never widen one. They exist because RLS cannot grant what the privilege
-- system has not.
-- ---------------------------------------------------------------------------

revoke all on table public.modules from anon, authenticated;
grant select on table public.modules to anon, authenticated;
grant insert, update, delete on table public.modules to authenticated;

revoke all on table public.lessons from anon, authenticated;
grant select on table public.lessons to anon, authenticated;
grant insert, update, delete on table public.lessons to authenticated;

revoke all on table public.topics from anon, authenticated;
grant select on table public.topics to anon, authenticated;
grant insert, update, delete on table public.topics to authenticated;

revoke all on table public.lesson_topics from anon, authenticated;
grant select on table public.lesson_topics to anon, authenticated;
grant insert, update, delete on table public.lesson_topics to authenticated;

-- lesson_contents is the paid content. `anon` gets NOTHING -- not a
-- restrictive policy, no privilege at all, so an anonymous request to
-- /rest/v1/lesson_contents is refused by the privilege system before RLS is
-- consulted. This is the same belt-and-braces posture the question bank will
-- take in a later migration.
revoke all on table public.lesson_contents from anon, authenticated;
grant select on table public.lesson_contents to authenticated;
grant insert, update, delete on table public.lesson_contents to authenticated;
