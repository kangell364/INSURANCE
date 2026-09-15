-- ===========================================================================
-- Phase 2 / 01 — Content enum types.
--
-- Mirrors the Phase 1 rationale for native enums over constrained text: one
-- authoritative definition, type safety inside policies and functions, and
-- automatic exposure to the generated TypeScript types.
-- ===========================================================================

-- Deliberately a SEPARATE type from public.course_status, even though the two
-- currently carry identical values.
--
-- A course's lifecycle and a lesson's lifecycle are different things that
-- happen to rhyme today. Sharing one type would mean that the first time
-- either side needs a value the other must not have -- a course that is
-- 'coming_soon', a lesson that is 'needs_review' -- every policy and every
-- switch statement on the other side silently gains a case it does not
-- handle. Two small types cost one extra declaration; one shared type costs a
-- migration that cannot be made safely.
create type public.content_status as enum ('draft', 'active', 'archived');

comment on type public.content_status is
  'Publication state for modules, lessons and (Phase 2 later) questions. '
  'Only active rows are visible to non-admins.';
