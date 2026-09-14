-- ===========================================================================
-- Minimal Supabase-compatible bootstrap for a PLAIN PostgreSQL instance.
--
-- Purpose: run the Phase 1 migrations and the RLS assertions on any stock
-- Postgres 15+ (CI, a laptop with `postgres` installed) when Docker — and
-- therefore `supabase start` / `supabase test db` — is not available.
--
-- It recreates only the pieces of a Supabase database that the Phase 1
-- migrations actually depend on: the four database roles, the `auth` schema
-- with `auth.users` and `auth.uid()`, and Supabase's default grant of ALL
-- privileges on public tables to `anon` / `authenticated` (which is precisely
-- what migration 05 revokes, so the shim must apply it for the test to be
-- meaningful).
--
-- This file is for TESTING ONLY. It is never applied to a real Supabase
-- project, which already provides all of it.
-- ===========================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end
$$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth authorization postgres;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Subset of Supabase's auth.users that the Phase 1 migrations touch.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  instance_id         uuid,
  aud                 text,
  role                text,
  email               text,
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Supabase's auth.uid() reads the JWT subject that PostgREST puts into the
-- request-local GUCs. Both spellings are supported, matching upstream.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants everything on new public tables to the API roles by
-- default. Reproduce it so that the REVOKE/GRANT hardening in migration 05
-- is genuinely exercised.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
