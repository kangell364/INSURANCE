-- ===========================================================================
-- Phase 1 / 05 — Authorization helpers
--
-- Everything in this file exists so that RLS policies can ask "is the caller
-- an admin?" without re-entering public.profiles' own policies (which would
-- recurse: a policy on profiles that SELECTs profiles).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- public.is_admin(uuid) -> boolean
--
-- WHY SECURITY DEFINER IS SAFE HERE:
--   1. It reads exactly one column of one table and returns a boolean. It
--      never returns row data and takes no free-form input that reaches SQL.
--   2. `set search_path = ''` means every name is schema-qualified at
--      definition time, so a caller cannot shadow `profiles` or `=` with an
--      object in a schema they control.
--   3. It is `stable` — it cannot write anything.
--   4. The only parameter is a uuid and it defaults to auth.uid(). Passing
--      someone else's uuid leaks nothing an attacker does not already know:
--      the answer is "that user is an admin", not any of their data.
--   5. EXECUTE is revoked from PUBLIC and granted only to `authenticated`
--      and `service_role` (see below) — anonymous visitors cannot call it.
--
-- It runs as the function owner (the migration/superuser role), which is why
-- it bypasses RLS on public.profiles and terminates instead of recursing.
-- Note that public.profiles deliberately does NOT use FORCE ROW LEVEL
-- SECURITY, which is what allows the owner to read it here.
--
-- A student cannot use this to grant themselves anything: the function only
-- reads. The write path for `role` is locked down separately, in the
-- column-level GRANTs and the immutability trigger below.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'::public.user_role
  );
$$;

comment on function public.is_admin(uuid) is
  'True when the given user (default: the current JWT subject) has role = '
  'admin. SECURITY DEFINER so RLS policies on profiles do not recurse.';

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Column-level write privileges on public.profiles.
--
-- This is the primary, non-bypassable guard against role escalation: the
-- `authenticated` database role is simply not granted UPDATE on the `role`
-- column, so `update profiles set role = 'admin'` is rejected by the
-- privilege system before RLS is even consulted.
--
-- Supabase's default grants hand `authenticated` UPDATE on every column of
-- every table in `public`, so we revoke and re-grant narrowly.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (first_name, last_name) on table public.profiles to authenticated;
-- Note that this applies to ADMINS TOO. An admin's browser session also
-- connects as the `authenticated` database role, so nobody holding an anon or
-- user JWT can write `role` — not even someone who already is an admin.
-- Promotion is deliberately an out-of-band operation performed with the
-- service-role key or the SQL editor (README: "Promoting the first
-- administrator"). Phase 1 ships no role-management UI, so there is no reason
-- for that column to be reachable from a browser at all. When a Phase 2+
-- admin UI needs it, it should go through a narrowly-scoped SECURITY DEFINER
-- function or a server action using the service-role key, not by widening
-- this grant.
-- No INSERT: profiles are created only by the auth.users trigger.
-- No DELETE: profiles are removed by cascade when the auth user is deleted.
-- No grants at all to `anon`.

revoke all on table public.courses from anon, authenticated;
grant select on table public.courses to anon, authenticated;
grant insert, update, delete on table public.courses to authenticated;
-- The write grants above are gated to admins by RLS (see the courses policy
-- migration). The grant is required because RLS can only narrow privileges,
-- never widen them.

revoke all on table public.enrollments from anon, authenticated;
grant select on table public.enrollments to authenticated;
grant insert, update, delete on table public.enrollments to authenticated;
-- Again: admin-only at the policy layer. Students have no write policy, so
-- these grants are inert for them.

-- ---------------------------------------------------------------------------
-- Defence in depth: make identity/role columns immutable for non-admins even
-- if a future migration accidentally widens the column grants above.
--
-- RLS alone cannot express this. An UPDATE policy's WITH CHECK clause sees
-- only the NEW row, so it cannot say "role must equal what it was". A BEFORE
-- UPDATE trigger sees both OLD and NEW and can.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server-side roles are allowed through so that migrations, the
  -- documented initial-admin promotion, and future back-office jobs work.
  -- PostgREST executes a service-role request as the `service_role` database
  -- role, so `current_user` is the accurate test here (`current_setting('role')`
  -- reports 'none' unless SET ROLE was used explicitly).
  if current_user in (
    'postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin'
  ) then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'profiles.created_at is immutable' using errcode = '42501';
  end if;

  -- Email is owned by Supabase Auth, not by the application. It is kept in
  -- sync by the auth trigger, never by a client update.
  if new.email is distinct from old.email then
    raise exception 'profiles.email is managed by Supabase Auth'
      using errcode = '42501';
  end if;

  -- Backstop only: in practice `authenticated` has no UPDATE privilege on
  -- `role` at all, so this branch is unreachable from the public API. It
  -- exists so that if a future migration ever widens the column grant, role
  -- changes still require admin status rather than silently becoming open.
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only an administrator may change profiles.role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_immutable_columns() is
  'Blocks non-admin changes to profiles.id / created_at / email / role. '
  'Backstop for the column-level GRANTs; RLS WITH CHECK cannot see OLD.';

create trigger profiles_enforce_immutable_columns
  before update on public.profiles
  for each row execute function public.enforce_profile_immutable_columns();
