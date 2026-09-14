-- ===========================================================================
-- Development seed data.
--
-- Applied automatically by `supabase db reset` for LOCAL development.
-- Contains marketing/catalog content only — no users, no passwords, no
-- credentials of any kind. Never add test accounts here.
-- ===========================================================================

insert into public.courses (title, slug, description, status)
values (
  'Texas General Lines Property & Casualty Exam Prep',
  'texas-general-lines-property-casualty',
  'Complete preparation for the Texas General Lines Property & Casualty '
  'licensing examination. Covers insurance fundamentals, policy provisions, '
  'property and casualty coverages, and Texas statutes and regulations.',
  'active'
)
on conflict (slug) do nothing;
