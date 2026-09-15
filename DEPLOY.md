# Deploying Texas Exam Prep

Two things are deployed separately: **the Next.js app** (Vercel, automatic on
push) and **the database schema** (Supabase, manual). This file is about the
second, because it is the one that has to be done by hand and the one that
blocks the content from appearing.

> This is the `texas-exam-prep/` project. The `DEPLOY.md` at the repository
> root belongs to the unrelated MedCheck app at the root, and points at a
> different Supabase project. Do not follow that one for this.

---

## What state is production in?

Run this in the Supabase SQL editor to find out before doing anything:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

| If you see | Then |
| ---------- | ---- |
| `profiles`, `courses`, `enrollments` only | Phase 1 is applied. Do **Step 1** below. |
| ...plus `modules`, `lessons`, `lesson_contents`, `topics` | Phase 2 schema is already applied. Skip to **Step 2**. |
| Nothing | Apply the Phase 1 migrations first, then Step 1. |

---

## Step 1 — Apply the Phase 2 schema (once)

This creates `modules`, `lessons`, `lesson_contents`, `topics` and
`lesson_completions`, with their grants and RLS policies.

### Option A — the Supabase CLI (preferred)

The CLI records which migrations have been applied, so it cannot double-apply
one or skip one.

```bash
cd texas-exam-prep
supabase link --project-ref <your-project-ref>
supabase db push
```

### Option B — the SQL editor

If the CLI is not installed, paste **`supabase/deploy/phase-2-schema.sql`**
into the Supabase SQL editor and run it. It is all eight Phase 2 migrations
concatenated in order, wrapped in a single transaction.

Regenerate it after changing any migration:

```bash
node scripts/build-deploy-sql.mjs
```

**These statements are not idempotent.** Running them a second time fails on an
existing type or table. That is correct behaviour, not a bug — and because the
file is one transaction, a failure part-way leaves the database exactly as it
was rather than half-migrated.

---

## Step 2 — Load the content

Two files, in this order:

1. **`supabase/seed.sql`** — the course row and the blueprint topic counts.
2. **`supabase/seed_content.sql`** — the modules, lessons and lesson bodies,
   generated from `content/` by the importer.

**Both are safe to run as many times as you like.** Every insert carries an
`on conflict` clause, so re-running updates what changed and leaves the rest
alone. This is the file you re-run whenever a lesson is edited.

Regenerate the content seed after editing any lesson:

```bash
node scripts/import-content.mjs
```

It prints how many lessons are publishable and how many are held as drafts.

---

## Step 3 — Why you still will not see a lesson

**Every lesson is currently `UNREVIEWED`, and the importer writes an
unreviewed lesson out as a `draft` whatever its front matter asks for.** The
RLS policies then hide draft lessons from students entirely — body included.

So after Steps 1 and 2, a signed-in student sees exactly this — verified by
querying as the `authenticated` role against a database with the real seed
loaded:

| | Visible |
| --- | ---: |
| Modules | **4** |
| Topics (the blueprint breakdown) | **28** |
| Lessons | **0** |
| Lesson bodies | **0** |

**The course page and its four module headings appear. No lesson titles
appear**, because `lessons_select_published` requires `status = 'active'` and
every lesson is a draft — the row itself is invisible, not just its body.

That is the system working. It is the safeguard that stops unreviewed material
reaching somebody who paid for the course. It also means **there is nothing to
click on until at least one lesson is reviewed**, which is worth knowing
before you go looking for one.

### To publish a lesson, properly

1. Read it.
2. Change the `review:` line in the Markdown file from
   `review: UNREVIEWED — ...` to something that records who checked it and
   when.
3. Set `status: active` in the same front matter.
4. `node scripts/import-content.mjs`
5. Re-run `supabase/seed_content.sql`.

Step 2 is the one that matters: `status: active` alone does nothing while the
`review:` line still says UNREVIEWED.

### To preview a lesson without publishing it

If you only want to look at one on the live site, flip a single row directly
and flip it back:

```sql
-- Preview one lesson. Remember to undo this.
update public.lessons set status = 'active'
where slug = 'deductibles-coinsurance-and-limits';

-- Undo.
update public.lessons set status = 'draft'
where slug = 'deductibles-coinsurance-and-limits';
```

You must also be **enrolled in the course**, because `lesson_contents`
requires both publication and a live enrollment. Publishing the lesson without
enrolling shows the title and withholds the body.

**Re-running `seed_content.sql` resets that row to `draft`**, since the seed is
generated from the file and the file still says UNREVIEWED. That is
deliberate: a temporary preview cannot quietly become a permanent publication.

---

## What is checked automatically

`scripts/test-rls-local.sh`, which CI runs on every push, applies the shim,
every migration, both seeds, then **re-applies both seeds** to prove they are
idempotent, then asserts that **no lesson was seeded as `active`**. A seed
that would publish an unreviewed lesson fails the build.

What CI does **not** check is production itself. Nothing here can tell you
whether the live project has had Step 1 run against it — that is what the
query at the top of this file is for.

---

## The app deployment

Vercel builds on push. The build must succeed **without** Supabase
credentials: `lib/env.ts` reports missing configuration rather than throwing,
and pages render a "not configured" state. A build that only passes when
secrets are present would hide exactly that behaviour, so CI builds without
them on purpose.

Environment variables the running app needs:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**There is no service-role key in this application, and there must not be
one.** Every query runs as the signed-in user through RLS. A service-role key
in the app would bypass every policy in `supabase/migrations/` and make the
entitlement model decorative.
