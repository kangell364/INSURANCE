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

There are **fourteen** tables when everything is applied:

| Phase | Tables |
| ----- | ------ |
| 1 | `profiles`, `courses`, `enrollments` |
| 2 | `modules`, `lessons`, `lesson_contents`, `topics`, `lesson_topics`, `lesson_completions` |
| 3 | `questions`, `question_options`, `question_answers`, `attempts`, `attempt_questions` |

| If you see | Then |
| ---------- | ---- |
| Nothing | Apply the Phase 1 migrations first, then Step 1. |
| Phase 1 only (3 tables) | Do **Step 1**, then **Step 1b**. |
| Phases 1 and 2 (9 tables) | Phase 2 is applied. Do **Step 1b**. |
| All fourteen | Schema is complete. Skip to **Step 2**. |

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

### If it fails

**Run `supabase/deploy/preflight.sql` first.** It is read-only — it creates
nothing and changes nothing.

> **It returns a single result set on purpose.** The Supabase SQL editor
> displays only the **last** statement's output, so the first version of this
> file, which used three separate `select`s, showed only the third — the
> environment summary, which is the least useful of them. Anything that must
> be read in that editor has to come back as one query.

The rows come in four groups:

1. **Phase 1 prerequisites.** The eight objects the Phase 2 migrations depend
   on: the types `course_status`, `enrollment_status` and `user_role`, the
   tables `courses`, `profiles` and `enrollments`, and the functions
   `is_admin()` and `set_updated_at()`. Anything marked `>>> MISSING` means
   **Phase 1 is not applied**, and that is the failure: the Phase 2 file
   references all eight by name.
2. **What Phase 2 would create.** Ten objects that should all be `absent`.
   Anything marked `>>> ALREADY EXISTS` means some of Phase 2 is already
   there, so the file cannot run again as-is.
3. **Verdict.** Two rows that answer the only two questions that matter: is
   Phase 1 complete, and is Phase 2 already present. **If you read nothing
   else, read these two.**
4. **Environment** — which role you are, the database, the PostgreSQL
   version, and whether the three Supabase API roles exist.

The two things preflight cannot see are worth stating plainly:

- **A failed run leaves nothing behind.** The file is one transaction, so a
  half-applied schema is not a state you can be in. If preflight says the
  Phase 2 objects are absent, the failure happened before anything was
  committed and you can safely try again once the cause is fixed.
- **A truncated paste is indistinguishable from a broken file.** The file is
  around 970 lines. If the SQL editor mangled it, the error will point at a
  statement that looks fine in the repository.

**For that case, use `supabase/deploy/steps/` instead** — the same eight
migrations, one file each, numbered in the order they must run, and **each
wrapped in its own transaction**:

```
01-content_types.sql          05-content_grants.sql
02-modules.sql                06-content_rls.sql
03-lessons.sql                07-lesson_completions.sql
04-topics.sql                 08-topic_question_count.sql
```

The largest is under 8 KB, so none of them can truncate the way one 40 KB
paste can, and whichever one errors names the migration. Because each is its
own transaction, a failure leaves **that step** unapplied while the steps
before it stay — verified by injecting a failure into step 2 and confirming
`content_status` exists and `modules` does not.

**Run them in order, and do not re-run one that succeeded** — they are not
idempotent. If you lose track, `preflight.sql` lists which of the ten objects
exist.

What has been verified about the file itself: it applies cleanly onto a
database carrying Phase 1, both as a superuser and as a non-superuser role
owning the schema (which is what Supabase's `postgres` is on newer projects),
and injecting a failure before the `commit` leaves zero Phase 2 tables behind.
So an error is far more likely to be about the state of the target database
than about the SQL.

---

## Step 1b — Apply the Phase 3 schema (once)

This creates the assessment tables — `questions`, `question_options`,
`question_answers`, `attempts`, `attempt_questions` — plus `score_attempt()`
and `start_attempt()`, which are what make a paper impossible to assemble or
mark from the browser.

### Option A — the Supabase CLI

`supabase db push` applies every outstanding migration in order, Phase 3
included. Nothing extra to do.

### Option B — psql

```bash
psql "<connection string>" -f supabase/deploy/phase-3-schema.sql
```

### Option C — the SQL editor

Paste **`supabase/deploy/phase-3-schema.sql`**.

> ### This file is NOT one transaction, and Phase 2's is
>
> Phase 3 adds a value to the `attempt_kind` enum, and PostgreSQL refuses to
> use a new enum value in the transaction that added it. The phase therefore
> cannot be wrapped in a single `begin; ... commit;` the way Phase 2 is, so
> the generated file uses **one transaction per migration**.
>
> The practical difference: a failure part-way through Phase 2 leaves nothing
> behind, while a failure part-way through Phase 3 leaves **the migrations
> before it applied**. That is recoverable, but not by re-running the whole
> file — the applied ones are not idempotent and will fail on an existing
> type or table.
>
> **If it fails, note which migration the error names**, fix the cause, and
> resume from that one using `supabase/deploy/steps/`. Steps `09`–`18` are
> Phase 3, one file each, in order.

### How this was found, and why the migrations changed shape

`alter type ... add value` and the constraints that use `'module'` were
originally a single migration. That worked for a year of local testing
because the harness ran migrations through `psql -f` with no explicit
transaction, so every statement committed on its own. It broke the first time
a migration was wrapped in a transaction — which is the ordinary and correct
way to run one.

The enum value now lives alone in `20260301000700_attempt_kind_module.sql`.
**Keep it alone.** A use of `'module'` added to that file reintroduces the
failure it exists to prevent.

---

## Step 2 — Load the content

Three files, in this order:

1. **`supabase/seed.sql`** — the course row and the blueprint topic counts.
   About 10 KB; pastes fine.
2. **`supabase/seed_content.sql`** — the modules, lessons and lesson bodies,
   generated from `content/` by the importer. **About 380 KB.**
3. **`supabase/seed_questions.sql`** — the question bank, its options and its
   answers, generated from `content/questions/` by `import-questions.mjs`.
   **About 1.3 MB.** Requires Phase 3, and requires psql: there is no chunked
   fallback for this one, and 1.3 MB will not go into a browser.

> ### The content seed is too big to paste
>
> 380 KB will not go into the Supabase SQL editor, and this is not a one-off
> problem: **the file is regenerated and re-applied every time a lesson is
> reviewed**, so it will be run dozens of times before the course is finished.
> Pasting it by hand is not a workable process.
>
> **Use a direct connection instead.** The connection string is in the Supabase
> dashboard under Project Settings → Database:
>
> ```
> psql "postgresql://postgres.<ref>:<password>@<host>:5432/postgres" \
>   -f supabase/seed.sql -f supabase/seed_content.sql -f supabase/seed_questions.sql
> ```
>
> or, with the Supabase CLI linked to the project:
>
> ```
> supabase db push          # migrations
> psql "$(supabase db url)" -f supabase/seed.sql \
>   -f supabase/seed_content.sql -f supabase/seed_questions.sql
> ```
>
> **Fallback, if neither tool is available:** `supabase/deploy/content/` holds
> the same statements as **19 numbered chunks**, largest 25 KB, each wrapped in
> its own transaction. Run them in order after `seed.sql`. Chunk boundaries
> fall between lessons, never inside one, and because every insert carries an
> `on conflict` clause **the chunks are safe to re-run** — unlike the schema
> steps. Verified: all 19 applied in order give 5 modules, 42 lessons, 42
> bodies, 42 topic tags, 0 active; re-applying all 19 changes nothing.

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

### Vercel project settings

Four settings, and the first one is the one that goes wrong.

| Setting | Value |
| ------- | ----- |
| **Framework Preset** | **Next.js** |
| Root Directory | *(empty — the app is the repository root)* |
| Build / Output / Install commands | defaults; selecting Next.js sets them |
| Production Branch | `main` |

> **Framework Preset must be Next.js, and it will not always detect itself.**
>
> This project was created on Vercel while the repository still held nothing
> but a `README.md`. Vercel inspects the repo at creation time, found no
> `package.json`, recorded **Other**, and kept it. "Other" means *copy the
> files, there is nothing to build*, with an output directory of `public` if
> one exists — and this app has a `public/` folder. So every build after the
> code landed **succeeded**, served the static assets as the whole site, and
> returned a Vercel 404 on every route.
>
> **The tell is the build duration.** A real build of this app takes a minute
> or two. The broken ones took **20 seconds**, because they were a file copy.
> If a deployment is Ready in under half a minute, it did not compile
> anything.
>
> Create the project *after* pushing the code, or check this setting first.

### Email delivery — a launch prerequisite

**Custom SMTP must be configured before anyone but you uses this.** Not
"should": the product does not work without it.

Supabase's built-in email sender exists so you can test signup during
development. It is rate-limited to a handful of messages an hour and is not
intended for production. On the built-in sender:

- a new customer's confirmation email may never arrive;
- nobody who forgets a password can get back in, because
  `/forgot-password` has nowhere to send;
- **both failures are silent**, and both land on somebody who has already
  paid.

This was discovered the obvious way — a password reset request produced no
email — and it is worth recording that the reset flow was built before anyone
checked that the thing it depends on actually delivers.

**Where:** Supabase dashboard → Project Settings → Authentication → SMTP
Settings. It needs a third-party sender: Resend, Postmark, SendGrid and
Amazon SES are the usual choices, and at this volume they are free or a few
dollars a month.

**Afterwards, test both paths end to end from a real inbox** — sign up as a
new user, and reset a password — because a misconfigured sender fails exactly
as silently as no sender at all.

**To get in meanwhile**, without email: Supabase dashboard → Authentication →
Users → open the user. An admin can set a password or issue a magic link
directly from there.

### Auth redirect URLs

Supabase only redirects back to allow-listed origins, so sign-in fails
silently until the deployed address is registered. In the Supabase dashboard,
**Authentication → URL Configuration**:

- **Site URL** — `https://<your-domain>`
- **Redirect URLs** — `https://<your-domain>/**`

**Use the project's stable domain** (`<project>-<team>.vercel.app`), not the
per-deployment URL with a hash in it. The hashed one is frozen to a single
build; the stable one always points at the newest production deployment.

### The rest

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
