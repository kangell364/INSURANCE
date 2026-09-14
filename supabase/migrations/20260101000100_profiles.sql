-- ===========================================================================
-- Phase 1 / 02 — profiles
--
-- One row per authenticated user, keyed by auth.users(id).
-- `role` lives here and is the single source of truth for authorization.
-- ===========================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text,
  last_name   text,
  email       text not null,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_first_name_length check (
    first_name is null or char_length(first_name) between 1 and 100
  ),
  constraint profiles_last_name_length check (
    last_name is null or char_length(last_name) between 1 and 100
  ),
  constraint profiles_email_length check (char_length(email) between 3 and 320)
);

comment on table public.profiles is
  'Application profile for each auth.users row. Deleted with the auth user.';
comment on column public.profiles.role is
  'Authorization role. Only admins (or the service role) may change it; see '
  'public.enforce_profile_immutable_columns().';

-- `on delete cascade`: a profile has no meaning without its auth user, and
-- deleting the auth user is the documented way to remove an account. Keeping
-- orphan profiles would leave personal data behind after an account deletion.

create index profiles_role_idx on public.profiles (role);
create unique index profiles_email_key on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
