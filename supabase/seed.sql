-- ===========================================================================
-- Development seed data.
--
-- Applied automatically by `supabase db reset` for LOCAL development.
-- Contains course content only — no users, no passwords, no credentials of any
-- kind. Never add test accounts here.
--
-- The lesson text below is a small, deliberately generic sample written to
-- exercise the renderer (headings, lists, a quote, emphasis, a link). It is
-- NOT exam preparation material and must be replaced before anyone pays for
-- it. See docs/competitor-research.md on why the real content cannot be
-- copied from the state's own publications or from ISO forms.
-- ===========================================================================

insert into public.courses (id, title, slug, description, status)
values (
  '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
  'Texas General Lines Property & Casualty Exam Prep',
  'texas-general-lines-property-casualty',
  'Complete preparation for the Texas General Lines Property & Casualty '
  'licensing examination. Covers insurance fundamentals, policy provisions, '
  'property and casualty coverages, and Texas statutes and regulations.',
  'active'
)
on conflict (slug) do nothing;
-- ---------------------------------------------------------------------------
-- The examination blueprint.
--
-- TRANSCRIBED FROM THE PRIMARY SOURCE: Pearson VUE publication #124401,
-- "TEXAS Insurance Supplement - Examination Content Outlines", effective
-- 1 September 2026. Section titles and question counts are reproduced exactly
-- as printed there.
--
--   PROPERTY AND CASUALTY - GENERAL KNOWLEDGE
--   (100 scoreable questions plus 10 pretest questions)
--     I.   Types of Policies ................................... 22
--     II.  Insurance Terms and Related Concepts ................ 15
--     III. Policy Provisions and Contract Law .................. 13
--     IV.  Types of Policies, Bonds, and Related Terms ......... 23
--     V.   Insurance Terms and Related Concepts ................ 15
--     VI.  Policy Provisions ................................... 12
--
--   PROPERTY AND CASUALTY AGENT - STATE SPECIFIC
--   (30 scoreable questions plus 5 pretest questions)
--     I.   Texas Statutes and Rules Common to P&C Insurance .... 18
--     II.  Texas Statutes and Rules Pertinent to P&C Insurance . 12
--
--   130 scoreable questions in total; 145 including pretest questions.
--
-- Three notes for whoever maintains this.
--
-- First, the blueprint gives COUNTS, not percentages, which is why
-- topics.question_count exists. Percentages shown to students are derived.
--
-- Second, ALWAYS transcribe from #124401 itself. Second-hand summaries of it
-- disagree: two web searches in September 2026 returned "145 questions
-- (100+10 general, 30+5 state)" and "150 questions (125 scorable plus 25
-- pretest)" respectively. Only the first matches the document.
--
-- Third, sections II and V share a title in the source, as do III and VI,
-- because the outline covers property and then casualty in two parallel
-- passes. The codes disambiguate them and a "(Casualty)" suffix is added to
-- the second of each pair for the UI; the rest of each name is left exactly
-- as published so it can be checked line by line.
--
-- The outline is a factual list of examinable subject areas, which is what
-- makes it safe to reproduce. The INSTRUCTIONAL CONTENT taught against it
-- must be written independently -- see docs/competitor-research.md.
-- ---------------------------------------------------------------------------
insert into public.topics
  (id, course_id, parent_topic_id, code, name, question_count,
   blueprint_weight, position)
values
  -- General knowledge: 100 scoreable questions.
  ('1a000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.I', 'Types of Policies', 22, null, 1),
  ('1a000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.II', 'Insurance Terms and Related Concepts', 15, null, 2),
  ('1a000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.III', 'Policy Provisions and Contract Law', 13, null, 3),
  ('1a000000-0000-4000-8000-000000000004',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.IV', 'Types of Policies, Bonds, and Related Terms', 23, null, 4),
  ('1a000000-0000-4000-8000-000000000005',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.V', 'Insurance Terms and Related Concepts (Casualty)', 15, null, 5),
  ('1a000000-0000-4000-8000-000000000006',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GK.VI', 'Policy Provisions (Casualty)', 12, null, 6),

  -- State specific: 30 scoreable questions.
  ('1a000000-0000-4000-8000-000000000007',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'TX.I',
   'Texas Statutes and Rules Common to Property and Casualty Insurance',
   18, null, 7),
  ('1a000000-0000-4000-8000-000000000008',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'TX.II',
   'Texas Statutes and Rules Pertinent to Property and Casualty Insurance',
   12, null, 8),

  -- Sub-topics, as listed beneath each section. The blueprint assigns counts
  -- at section level only, so these carry none.
  ('1b000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GK.I.A', 'Homeowners', null, null, 1),
  ('1b000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GK.I.B', 'Dwelling policies', null, null, 2),
  ('1b000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GK.I.C', 'Commercial lines', null, null, 3),
  ('1b000000-0000-4000-8000-000000000004',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GK.I.D', 'Inland marine', null, null, 4),
  ('1b000000-0000-4000-8000-000000000005',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GK.I.E', 'National Flood Insurance Program', null, null, 5),
  ('1b000000-0000-4000-8000-000000000006',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.A', 'Commercial general liability', null, null, 1),
  ('1b000000-0000-4000-8000-000000000007',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.B', 'Automobile: personal auto and business auto', null, null, 2),
  ('1b000000-0000-4000-8000-000000000008',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.C',
   'Workers Compensation and Employers Liability Insurance', null, null, 3),
  ('1b000000-0000-4000-8000-000000000009',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.D', 'Crime', null, null, 4),
  ('1b000000-0000-4000-8000-00000000000a',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.E', 'Bonds', null, null, 5),
  ('1b000000-0000-4000-8000-00000000000b',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.F', 'Professional liability', null, null, 6),
  ('1b000000-0000-4000-8000-00000000000c',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.G', 'Umbrella / Excess Liability', null, null, 7),
  ('1b000000-0000-4000-8000-00000000000d',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000004',
   'GK.IV.H', 'Business Owners Policy (BOP)', null, null, 8),
  ('1b000000-0000-4000-8000-00000000000e',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000007',
   'TX.I.A', 'Commissioner of Insurance', null, null, 1),
  ('1b000000-0000-4000-8000-00000000000f',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000007',
   'TX.I.B', 'Insurance definitions', null, null, 2),
  ('1b000000-0000-4000-8000-000000000010',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000007',
   'TX.I.C', 'Licensing requirements', null, null, 3),
  ('1b000000-0000-4000-8000-000000000011',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000007',
   'TX.I.D', 'Marketing practices', null, null, 4),
  ('1b000000-0000-4000-8000-000000000012',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000008',
   'TX.II.A', 'Property and casualty definitions', null, null, 1),
  ('1b000000-0000-4000-8000-000000000013',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000008',
   'TX.II.B', 'Surplus lines', null, null, 2),
  ('1b000000-0000-4000-8000-000000000014',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000008',
   'TX.II.C', 'Approval of rates and forms', null, null, 3)
on conflict (course_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- Modules, lessons and lesson bodies are NOT seeded here.
--
-- They live in content/ as Markdown, one file per lesson, and are turned into
-- SQL by scripts/import-content.mjs:
--
--     node scripts/import-content.mjs
--     psql -f supabase/seed_content.sql
--
-- The split is deliberate. This file holds STRUCTURAL and REFERENCE data --
-- the course row and the published examination blueprint -- which is
-- transcribed from a primary source and changes only when the state changes
-- it. Lesson content is written, reviewed and revised constantly, and it needs
-- to be reviewable as prose rather than as SQL string literals.
--
-- Keeping both here also produced a real collision: the sample module this
-- file used to create sat at position 1 of the course, and so did the first
-- imported module, tripping modules_course_position_key.
-- ---------------------------------------------------------------------------
