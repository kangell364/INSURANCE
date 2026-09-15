-- Texas Exam Prep — deployment preflight
--
-- READ ONLY. Creates nothing, changes nothing.
--
-- Paste the whole file into the Supabase SQL editor and run it. It returns
-- ONE result set on purpose: the editor displays only the last statement's
-- output, so an earlier version of this file split into three sections and
-- showed only the third, which is the least useful of them.
--
-- Read the `verdict` column. Anything starting with ">>>" needs attention.

with required(sort_key, kind, name, why) as (values
  -- Phase 1 objects that the Phase 2 migrations reference BY NAME. If any is
  -- missing, phase-2-schema.sql cannot succeed.
  (1, 'type',  'course_status',      'modules/lessons RLS checks the parent course status'),
  (1, 'type',  'enrollment_status',  'is_enrolled_in_course() compares against it'),
  (1, 'type',  'user_role',          'is_admin() reads profiles.role'),
  (1, 'table', 'courses',            'modules.course_id references it'),
  (1, 'table', 'profiles',           'is_admin() reads it'),
  (1, 'table', 'enrollments',        'is_enrolled_in_course() reads it'),
  (1, 'func',  'is_admin',           'every admin RLS policy calls it'),
  (1, 'func',  'set_updated_at',     'modules and lessons attach it as a trigger')
),
creates(sort_key, kind, name, why) as (values
  -- Objects Phase 2 WOULD create. All should be absent.
  (2, 'type',  'content_status',        'created by 20260201000000'),
  (2, 'table', 'modules',               'created by 20260201000100'),
  (2, 'table', 'lessons',               'created by 20260201000200'),
  (2, 'table', 'lesson_contents',       'created by 20260201000200'),
  (2, 'table', 'topics',                'created by 20260201000300'),
  (2, 'table', 'lesson_topics',         'created by 20260201000300'),
  (2, 'table', 'lesson_completions',    'created by 20260201000600'),
  (2, 'func',  'is_enrolled_in_course', 'created by 20260201000400'),
  (2, 'func',  'lesson_is_published',   'created by 20260201000400'),
  (2, 'func',  'enforce_topic_depth',   'created by 20260201000300')
),
all_objects as (
  select * from required union all select * from creates
),
checked as (
  select o.*,
    case o.kind
      when 'type'  then exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                                 where n.nspname = 'public' and t.typname = o.name)
      when 'table' then exists (select 1 from information_schema.tables
                                 where table_schema = 'public' and table_name = o.name)
      when 'func'  then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = o.name)
    end as found
  from all_objects o
)
select sort_key, section, item, verdict, detail from (
  -- 1. Prerequisites
  select
    sort_key,
    '1. PHASE 1 PREREQUISITE'::text as section,
    (kind || ' ' || name)::text     as item,
    case when found then 'ok'
         else '>>> MISSING — apply the Phase 1 migrations first' end::text as verdict,
    why::text                       as detail,
    name as ord
  from checked where sort_key = 1

  union all

  -- 2. What Phase 2 creates
  select
    sort_key,
    '2. PHASE 2 WOULD CREATE'::text,
    (kind || ' ' || name)::text,
    case when found then '>>> ALREADY EXISTS — Phase 2 is applied, wholly or partly'
         else 'absent (expected)' end::text,
    why::text,
    name
  from checked where sort_key = 2

  union all

  -- 3. Summary — the two lines that decide what happens next
  select 3, '3. VERDICT'::text, 'Phase 1 complete?'::text,
    case when (select count(*) from checked where sort_key = 1 and not found) = 0
         then 'YES — all 8 prerequisites present'
         else '>>> NO — ' || (select count(*) from checked where sort_key = 1 and not found)
              || ' of 8 missing. Apply Phase 1 first.' end::text,
    'phase-2-schema.sql references all 8 by name'::text, 'a'
  union all
  select 3, '3. VERDICT'::text, 'Phase 2 already present?'::text,
    case when (select count(*) from checked where sort_key = 2 and found) = 0
         then 'NO — none of the 10 objects exist, so it is safe to run'
         else '>>> PARTLY — ' || (select count(*) from checked where sort_key = 2 and found)
              || ' of 10 already exist' end::text,
    'a failed run rolls back, so this should normally be zero'::text, 'b'

  union all

  -- 4. Environment
  select 4, '4. ENVIRONMENT'::text, 'running as'::text, current_user::text, ''::text, 'a'
  union all
  select 4, '4. ENVIRONMENT'::text, 'database'::text, current_database()::text, ''::text, 'b'
  union all
  select 4, '4. ENVIRONMENT'::text, 'postgres version'::text,
    substring(version() from 'PostgreSQL [0-9.]+')::text, ''::text, 'c'
  union all
  select 4, '4. ENVIRONMENT'::text, 'supabase API roles'::text,
    (select count(*)::text from pg_roles where rolname in ('anon','authenticated','service_role'))
      || ' of 3 present', ''::text, 'd'
) q
order by sort_key, ord;
