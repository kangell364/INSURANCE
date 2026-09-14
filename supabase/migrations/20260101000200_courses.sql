-- ===========================================================================
-- Phase 1 / 03 — courses
--
-- A course is the top-level container students enrol in. Phase 2 will hang
-- modules / lessons / topics off this table; nothing here presumes that shape.
-- ===========================================================================

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null,
  description text,
  status      public.course_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint courses_title_length check (char_length(title) between 1 and 200),
  constraint courses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint courses_slug_length check (char_length(slug) between 1 and 120)
);

comment on table public.courses is
  'Exam-prep courses. Only status = active is readable by non-admins.';

create unique index courses_slug_key on public.courses (slug);

-- Every non-admin read filters on `status`, and the catalog pages order by
-- title, so index the pair.
create index courses_status_title_idx on public.courses (status, title);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();
