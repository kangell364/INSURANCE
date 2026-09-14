-- ===========================================================================
-- Phase 1 / 06 — Automatic profile creation
--
-- A profile row is created by the database the moment Supabase Auth creates a
-- user. Doing it here rather than in application code means:
--   * it cannot be skipped by a client that never calls our API,
--   * it runs inside the same transaction as the auth user insert, and
--   * the role can be pinned server-side with no client involvement.
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_first_name text;
  meta_last_name  text;
begin
  -- raw_user_meta_data is fully client-controlled (it is whatever was passed
  -- to supabase.auth.signUp({ options: { data } })). Only two string fields
  -- are read from it, and both are trimmed and length-capped.
  --
  -- `role` is NEVER read from metadata. Every public registration is a
  -- student. Promotion happens through a privileged path only — see README
  -- "Promoting the first administrator".
  meta_first_name := nullif(
    left(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 100),
    ''
  );
  meta_last_name := nullif(
    left(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 100),
    ''
  );

  insert into public.profiles (id, first_name, last_name, email, role)
  values (
    new.id,
    meta_first_name,
    meta_last_name,
    new.email,
    'student'::public.user_role
  )
  -- Idempotent: re-running the trigger (or a manual backfill) for a user that
  -- already has a profile is a no-op rather than a signup failure.
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates public.profiles row for a new auth user. Role is hard-coded to '
  'student; signup metadata can never set it.';

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep profiles.email in step with auth.users.email when a user changes their
-- address through Supabase Auth (the only supported way to change it).
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_user_email_change()
  from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Backfill: create profiles for any auth users that predate this migration.
-- Safe to run on an empty database.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, first_name, last_name, email, role)
select
  u.id,
  nullif(left(btrim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), 100), ''),
  nullif(left(btrim(coalesce(u.raw_user_meta_data ->> 'last_name', '')), 100), ''),
  u.email,
  'student'::public.user_role
from auth.users u
where u.email is not null
on conflict (id) do nothing;
