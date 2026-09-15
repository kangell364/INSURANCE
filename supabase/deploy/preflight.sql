-- Texas Exam Prep — deployment preflight
--
-- READ ONLY. Creates nothing, changes nothing. Run this in the Supabase SQL
-- editor to find out why phase-2-schema.sql failed, or before running it.
--
-- Every row is a thing the Phase 2 migrations need. Read the `verdict` column.

with required(kind, name, why) as (values
  -- Phase 1 types the Phase 2 tables and policies reference.
  ('type',  'course_status',      'lessons/modules RLS checks the parent course status'),
  ('type',  'enrollment_status',  'is_enrolled_in_course() compares against it'),
  ('type',  'user_role',          'is_admin() reads profiles.role'),
  -- Phase 1 tables the Phase 2 foreign keys and policies point at.
  ('table', 'courses',            'modules.course_id references it'),
  ('table', 'profiles',           'is_admin() reads it'),
  ('table', 'enrollments',        'is_enrolled_in_course() reads it'),
  -- Phase 1 functions the Phase 2 migrations call by name.
  ('func',  'is_admin',           'every admin RLS policy calls it'),
  ('func',  'set_updated_at',     'modules and lessons attach it as a trigger')
),
present as (
  select r.kind, r.name, r.why,
         case r.kind
           when 'type'  then exists (
             select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typname = r.name)
           when 'table' then exists (
             select 1 from information_schema.tables
             where table_schema = 'public' and table_name = r.name)
           when 'func'  then exists (
             select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = r.name)
         end as found
  from required r
)
select
  '1. PREREQUISITES (all must be present)' as section,
  kind, name,
  case when found then 'ok' else '>>> MISSING — apply the Phase 1 migrations first' end as verdict,
  why
from present
order by found, kind, name;

-- ---------------------------------------------------------------------------

with created(kind, name) as (values
  ('type',  'content_status'),
  ('table', 'modules'),
  ('table', 'lessons'),
  ('table', 'lesson_contents'),
  ('table', 'topics'),
  ('table', 'lesson_topics'),
  ('table', 'lesson_completions'),
  ('func',  'is_enrolled_in_course'),
  ('func',  'lesson_is_published'),
  ('func',  'enforce_topic_depth')
)
select
  '2. WHAT PHASE 2 WOULD CREATE (all should be absent)' as section,
  kind, name,
  case when (case kind
      when 'type'  then exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname=name)
      when 'table' then exists (select 1 from information_schema.tables where table_schema='public' and table_name=name)
      when 'func'  then exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=name)
    end)
    then '>>> ALREADY EXISTS — Phase 2 has been applied, in whole or in part'
    else 'absent (expected)'
  end as verdict
from created
order by kind, name;

-- ---------------------------------------------------------------------------

select
  '3. VERSIONS AND IDENTITY' as section,
  current_user                                as running_as,
  current_database()                          as database,
  substring(version() from 'PostgreSQL [0-9]+') as postgres,
  (select count(*) from pg_roles
    where rolname in ('anon','authenticated','service_role')) as supabase_roles_found;

-- ---------------------------------------------------------------------------
-- If section 1 is all ok and section 2 is all absent, phase-2-schema.sql
-- should apply. If it still fails, the error text names the statement --
-- send that, not "it failed".
