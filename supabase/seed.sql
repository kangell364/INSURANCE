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
-- Blueprint topics.
--
-- Weightings are illustrative placeholders. Replace them with the figures from
-- the current Texas candidate handbook before publishing — a wrong weighting
-- sends students to study the wrong things, which is the single most damaging
-- error this product can make.
-- ---------------------------------------------------------------------------
insert into public.topics
  (id, course_id, parent_topic_id, code, name, blueprint_weight, position)
values
  ('1a000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GL.01', 'Insurance Fundamentals', 15.00, 1),
  ('1a000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GL.01.01', 'Risk, peril and hazard', null, 1),
  ('1a000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   '1a000000-0000-4000-8000-000000000001',
   'GL.01.02', 'Insurable interest and indemnity', null, 2),
  ('1a000000-0000-4000-8000-000000000004',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GL.02', 'Policy Provisions', 20.00, 2),
  ('1a000000-0000-4000-8000-000000000005',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60', null,
   'GL.03', 'Texas Statutes and Regulations', 25.00, 3)
on conflict (course_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- Modules and lessons.
-- ---------------------------------------------------------------------------
insert into public.modules (id, course_id, title, description, position, status)
values
  ('2b000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Insurance Fundamentals',
   'The vocabulary every later module assumes you already have.',
   1, 'active'),
  ('2b000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Policy Structure and Provisions',
   'How a policy is assembled, and which part answers which question.',
   2, 'active'),
  -- Left as a draft on purpose: the local database then has at least one row
  -- that must NOT appear to a student, so the syllabus pages are exercised
  -- against real hidden content rather than against an empty case.
  ('2b000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Texas Statutes and Regulations',
   'Being written.',
   3, 'draft')
-- Arbitrated on the primary key, not on (course_id, position): ON CONFLICT
-- cannot use a DEFERRABLE unique constraint as an arbiter, and that one is
-- deferrable so modules can be reordered in a single transaction.
on conflict (id) do nothing;

insert into public.lessons
  (id, module_id, course_id, title, slug, summary, position, status,
   estimated_minutes)
values
  ('3c000000-0000-4000-8000-000000000001',
   '2b000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Risk, Peril and Hazard', 'risk-peril-and-hazard',
   'Three words the exam treats as distinct and everyday speech does not.',
   1, 'active', 15),
  ('3c000000-0000-4000-8000-000000000002',
   '2b000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Insurable Interest', 'insurable-interest',
   'Who is allowed to buy a policy on what, and why the rule exists.',
   2, 'active', 12),
  ('3c000000-0000-4000-8000-000000000003',
   '2b000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'The Declarations Page', 'the-declarations-page',
   'The one page that answers who, what, when and how much.',
   1, 'active', 10),
  ('3c000000-0000-4000-8000-000000000004',
   '2b000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
   'Conditions and Exclusions', 'conditions-and-exclusions',
   'Draft — not yet visible to students.',
   2, 'draft', null)
on conflict (module_id, slug) do nothing;

insert into public.lesson_topics (lesson_id, topic_id, course_id) values
  ('3c000000-0000-4000-8000-000000000001',
   '1a000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60'),
  ('3c000000-0000-4000-8000-000000000002',
   '1a000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60'),
  ('3c000000-0000-4000-8000-000000000003',
   '1a000000-0000-4000-8000-000000000004',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60')
on conflict (lesson_id, topic_id) do nothing;

insert into public.lesson_contents (lesson_id, course_id, body) values
  ('3c000000-0000-4000-8000-000000000001',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
$md$# Three words, three meanings

In ordinary speech *risk*, *peril* and *hazard* are near-synonyms. The exam
treats them as three separate ideas, and several questions turn on nothing more
than telling them apart.

## Risk

**Risk** is uncertainty about loss. Note what that does *not* say: it does not
say the loss is likely, or large, only that the outcome is not known in advance.

There are two kinds, and only one is insurable:

- **Pure risk** — either a loss happens or nothing happens. A house either
  burns or it does not. This is insurable.
- **Speculative risk** — the outcome may be a loss *or* a gain. Opening a
  restaurant, buying a stock. This is not insurable.

> If someone can profit from the event, an insurer will not cover it. That one
> sentence answers a surprising number of exam questions.

## Peril

A **peril** is the cause of loss itself — fire, hail, theft, collision. When a
policy lists what it covers, it is listing perils.

## Hazard

A **hazard** is a condition that makes a peril more likely or more severe. The
exam expects three categories:

1. **Physical hazard** — a condition of the property. Oily rags in a basement.
2. **Moral hazard** — a dishonest tendency in the insured. Someone who has
   arranged a convenient fire before.
3. **Morale hazard** — carelessness that comes *from* being insured. Leaving a
   car unlocked because the policy will pay.

The last two are the pair most often confused. Moral is dishonesty; morale is
indifference.

---

*This sample lesson exists to exercise the platform. Replace it with reviewed
instructional content before publishing.*
$md$),
  ('3c000000-0000-4000-8000-000000000002',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
$md$# Insurable interest

You may only insure something you would genuinely lose by. That is the whole
rule, and every detail below follows from it.

## Why the rule exists

Without it, an insurance policy is a bet. Anyone could take out a fire policy on
a stranger's warehouse and then hope for a fire — which gives a stranger a
financial reason to want that warehouse to burn. Requiring an interest removes
the motive.

## When it must exist

This is the detail the exam tests, and property and life insurance answer it
differently:

- **Property and casualty** — the interest must exist **at the time of the
  loss**. You can insure a building you later sell; the claim fails because the
  interest is gone, not because it never existed.
- **Life** — the interest must exist **when the policy is taken out**, and need
  not survive. A divorced spouse may still be the beneficiary.

## Who has one

- An owner, in their own property.
- A lender, up to the amount outstanding.
- A business, in a key employee.
- A spouse, in the other spouse's life.

*Sample content — replace before publishing.*
$md$),
  ('3c000000-0000-4000-8000-000000000003',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
$md$# The declarations page

The **declarations page** — the "dec page" — is the front of the policy and the
only part specific to one customer. Everything behind it is standard printed
form language.

It answers four questions:

1. **Who** is insured — the named insured, and often a mortgagee or loss payee.
2. **What** is insured — the described property or the covered auto.
3. **When** — the policy period, with an inception and an expiration.
4. **How much** — the limits of liability, and the deductible.

## Why it is worth knowing cold

When a question gives you a fact pattern and asks where you would look, the
answer is usually the dec page. Limits, deductibles and effective dates all live
there, and none of them are in the form language behind it.

Texas-specific filing requirements are published by the
[Texas Department of Insurance](https://www.tdi.texas.gov/).

*Sample content — replace before publishing.*
$md$),
  -- A body for the DRAFT lesson, so local development has content that is
  -- present in the table and must still never reach a student.
  ('3c000000-0000-4000-8000-000000000004',
   '0f2b8a14-6d5f-4c2e-9a3b-7c1d8e5f2a60',
$md$# Conditions and exclusions

Draft. Not published, and not readable by any student — if this text ever
appears on a student's screen, something is badly wrong.
$md$)
on conflict (lesson_id) do nothing;
