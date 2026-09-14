-- ===========================================================================
-- Phase 1 / 01 — Shared enum types and the reusable updated_at helper.
--
-- DESIGN NOTE (enum vs. constrained text):
-- We use native PostgreSQL enum types rather than `text ... check (...)`.
--   * Pros: a single authoritative definition, type safety across every
--     function and policy, smaller on-disk representation, and PostgREST
--     exposes them to the generated TypeScript types automatically.
--   * Cost: adding a value requires a migration
--     (`alter type public.user_role add value 'x';`) and values cannot be
--     removed or reordered in place.
-- The Phase 1 value sets are small, stable and security-relevant (especially
-- `user_role`), so the rigidity is a feature: nobody can introduce an
-- unexpected role by writing a stray string.
-- ===========================================================================

create type public.user_role as enum ('student', 'instructor', 'admin');

create type public.course_status as enum ('draft', 'active', 'archived');

create type public.enrollment_status as enum (
  'active',
  'completed',
  'expired',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Reusable trigger function that keeps `updated_at` honest.
--
-- Attached (below, per table) as a BEFORE UPDATE trigger so the value is
-- maintained by the database and cannot be spoofed by a client that sends its
-- own `updated_at` in the request body.
--
-- `set search_path = ''` pins name resolution so the function cannot be
-- hijacked by a schema earlier on a caller's search_path.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger helper: stamps updated_at with the server clock.';
