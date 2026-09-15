# Texas Insurance Exam Prep Platform

Exam preparation for Texas insurance licensing examinations, beginning with the
**Texas General Lines Property & Casualty** exam.

The platform is being built for candidates — mostly working adults — who need
structured coursework, topic-tagged practice, and full-length timed exam
simulations, plus the instructor and administrator tooling to run all of it.

---

## Current phase

**Phase 1 (complete) and Phase 2 step 1 (complete).**

Phase 1 delivers:

- A Next.js App Router application in TypeScript with Tailwind CSS
- Supabase Postgres schema, delivered as version-controlled migrations
- Row-Level Security on every application table, written in migrations
- Supabase Auth: signup, login, logout, session persistence
- Server-validated protected student routes and a database-validated admin route
- A basic student dashboard, My Courses page and profile editor
- An admin shell with placeholder navigation for later phases
- Automated database/RLS tests and an application test suite

**Phase 2 step 1 — course content** adds:

- `modules`, `lessons`, `lesson_contents`, `topics` and `lesson_topics`, with
  RLS on every one
- A **public syllabus**: module and lesson titles are readable by anyone,
  including search engines, at `/courses/[slug]`
- **Paid lesson bodies**: `lesson_contents` grants nothing to `anon` and is
  released by RLS only to a caller holding a live enrollment
- A lesson reader at `/dashboard/courses/[courseSlug]/[lessonSlug]` with
  cross-module previous/next navigation
- A restricted Markdown renderer that cannot emit HTML (see
  `lib/markdown.ts`)
- The readiness scale (`lib/readiness.ts`) — the thresholds the eventual
  scoring will use

**Phase 2 step 2 — content authoring** adds admin screens at `/admin/content`:

- A course content tree showing modules and lessons with their draft/published
  state, which lessons have no body yet, and reorder / publish / delete
  controls
- Module and lesson forms, with the slug derived from the title until an
  author edits it (after which it never moves again, because it is a public
  URL by then)
- A Markdown lesson editor with a preview rendered through the **same**
  component the student sees, so the preview cannot disagree with the page
- Exam blueprint management, including a warning when the topic weightings do
  not total 100%

Still **not** included: quizzes, the question bank, the exam simulator,
scoring, reporting and payments. Creating a *course* is also still a SQL
operation — everything inside one is editable in the UI. Where the UI shows a
section for one of those, it is explicitly labelled as upcoming rather than
populated with invented data.

### Repository layout note

This application lives in the `texas-exam-prep/` subdirectory. The repository
root contains a separate, unrelated Next.js application (`medcheck`) with its
own `app/`, `lib/` and `supabase/migrations/` directories. Keeping the two apart
avoids route collisions (`/login`, `/signup`, `/dashboard` exist in both) and
keeps the two migration histories independent. Run every command below from
inside `texas-exam-prep/`.

---

## Technology

| Layer          | Choice                                   |
| -------------- | ---------------------------------------- |
| Framework      | Next.js 16 (App Router)                  |
| Language       | TypeScript (strict)                      |
| UI             | React 19, Tailwind CSS v4                |
| Database       | Supabase PostgreSQL                      |
| Authentication | Supabase Auth (`@supabase/ssr`)          |
| Testing        | Vitest, React Testing Library, pgTAP/SQL |

---

## Setup

### Prerequisites

- Node.js 20 or newer (developed on 22)
- npm 10 or newer
- A Supabase project — either hosted, or local via the
  [Supabase CLI](https://supabase.com/docs/guides/cli) (which needs Docker)

### Install

```bash
cd texas-exam-prep
npm install
```

### Environment

```bash
cp .env.example .env.local
```

Fill in the values from **Supabase Dashboard → Project Settings → API**:

| Variable                        | Scope       | Purpose                                               |
| ------------------------------- | ----------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public      | Your project's API URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public      | Low-privilege key; all access still filtered by RLS   |
| `NEXT_PUBLIC_SITE_URL`          | Public      | Base URL used to build auth redirect links            |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only | **Not used in Phase 1.** Reserved for future back-office jobs |

`.env.local` is git-ignored. Never commit real credentials.

> **The service-role key bypasses Row-Level Security completely.** It must never
> appear in a Client Component, never be prefixed with `NEXT_PUBLIC_`, and never
> be committed. Phase 1 does not use it at all; it is documented only so that
> future server-side code has one sanctioned name for it.

### Develop

```bash
npm run dev          # http://localhost:3000
```

### Production build

```bash
npm run build
npm run start
```

---

## Supabase setup

### Option A — hosted project

```bash
# 1. Create a project at https://supabase.com/dashboard
# 2. Link this repository to it (project ref is in the dashboard URL)
npx supabase link --project-ref <your-project-ref>

# 3. Apply every migration in supabase/migrations, in order
npx supabase db push

# 4. Optional: the development seed course
npx supabase db execute --file supabase/seed.sql
```

### Option B — local stack (requires Docker)

```bash
npx supabase start       # boots Postgres, Auth, Studio, and a mail catcher
npx supabase db reset    # applies all migrations, then supabase/seed.sql
```

`supabase start` prints a local API URL and anon key — put those in
`.env.local`. Confirmation emails are captured by Inbucket at
<http://localhost:54324> rather than being sent.

### Auth configuration

In **Authentication → URL Configuration**:

- **Site URL** — your deployed origin (locally, `http://localhost:3000`)
- **Redirect URLs** — add `<origin>/auth/callback`

In **Authentication → Providers → Email**:

- Enable **Email** signup.
- Keep **Confirm email** enabled for any hosted environment. The signup form
  already handles the "check your inbox" path. `supabase/config.toml` disables
  confirmation for local development only, so you are not chasing emails while
  building.

### Regenerating database types

`types/database.ts` is hand-written but matches the generated shape exactly.
Once the CLI is part of your workflow, replace it wholesale:

```bash
npx supabase gen types typescript --linked > types/database.ts
# or, against the local stack:
npx supabase gen types typescript --local > types/database.ts
```

---

## Database

Three tables, all in the `public` schema.

### `profiles`

One row per `auth.users` row, created automatically by a trigger.

| Column                    | Notes                                                      |
| ------------------------- | ---------------------------------------------------------- |
| `id` (PK)                 | `uuid`, references `auth.users(id)` **on delete cascade**   |
| `first_name`, `last_name` | `text`, optional, max 100 chars — the only user-editable fields |
| `email`                   | `text`, not null, unique (case-insensitive); mirrored from Auth |
| `role`                    | `user_role` enum: `student` / `instructor` / `admin`, defaults to `student` |
| `created_at`              | `timestamptz`, immutable                                    |
| `updated_at`              | `timestamptz`, maintained by a trigger                      |

**Why an enum rather than constrained text?** One authoritative definition, type
safety in every function and policy, and the values are exposed to generated
TypeScript automatically. The cost is that adding a value needs a migration
(`alter type public.user_role add value '…'`), which for a security-relevant
column is a feature: nobody can introduce a role by writing a stray string.

**Why `on delete cascade`?** A profile has no meaning without its auth user.
Deleting the auth user is the documented way to remove an account, and orphan
profiles would leave personal data behind after a deletion request.

### `courses`

| Column        | Notes                                                        |
| ------------- | ------------------------------------------------------------ |
| `id` (PK)     | `uuid`, generated                                            |
| `title`       | `text`, 1–200 chars                                          |
| `slug`        | `text`, unique, `^[a-z0-9]+(-[a-z0-9]+)*$`                   |
| `description` | `text`, optional                                             |
| `status`      | `course_status` enum: `draft` / `active` / `archived`        |
| timestamps    | `created_at`, `updated_at` (trigger-maintained)              |

Indexed on `(status, title)` — the shape of every catalogue query — plus the
unique index on `slug`.

### `enrollments`

| Column        | Notes                                                         |
| ------------- | ------------------------------------------------------------- |
| `id` (PK)     | `uuid`, generated                                             |
| `student_id`  | → `profiles(id)` **on delete cascade**                        |
| `course_id`   | → `courses(id)` **on delete restrict**                        |
| `status`      | `enrollment_status`: `active` / `completed` / `expired` / `cancelled` |
| `enrolled_at` | `timestamptz`, defaults to now                                |
| `expires_at`  | `timestamptz`, optional, must be after `enrolled_at`          |

**`unique (student_id, course_id)`.** The dashboard, progress tracking and (in
later phases) exam eligibility all answer "is this student enrolled in this
course?". A second row makes that ambiguous and invites duplicate billing.
Re-enrolling a lapsed student updates the existing row rather than inserting a
new one; if a full purchase history is needed later, it belongs in a separate
immutable `orders` table.

**`on delete restrict` on `course_id`** so that deleting a course cannot
silently destroy students' access records. Archive the course instead.

Indexed on `student_id`, `course_id`, and `(student_id, status)`.

---

## Content schema (Phase 2)

```
course
  └── module            ordered within the course
        └── lesson      ordered within the module  ← PUBLIC metadata
              └── lesson_contents                  ← PAID body

topic                   the state's exam blueprint, a separate hierarchy
  └── lesson_topics     many-to-many with lessons
```

### Why the lesson body is a separate table

A lesson has two halves with different audiences. Its **metadata** — title,
slug, position, estimated minutes — is the public syllabus: what a prospective
student reads before paying, and what a search engine indexes. Its **body** is
the product, and must reach only a student with a live enrollment.

Those two rules cannot both apply to one row. RLS decides which **rows** a
caller sees; column GRANTs decide which **columns** a **role** may touch.
Neither expresses "this caller may read these columns of this row but not those
columns of the same row" — an anonymous visitor and an enrolled student both
connect as a database role, and the student's privilege is a property of their
*enrollment*, not of their role. A single `lessons.body` column therefore has
no correct grant: granting it gives the course away, revoking it hides the
course from the people who paid.

So the body lives in `public.lesson_contents`, which grants **nothing** to
`anon` and whose policy requires both publication and a live enrollment. This
is the same reasoning that will put the answer key in its own table rather than
in a column of `question_options`.

### Denormalised `course_id`, held true by composite foreign keys

`lessons`, `lesson_contents` and `lesson_topics` each carry `course_id`, which
looks like a normalisation error. It is not: `modules` and `lessons` each carry
a `unique (id, course_id)`, and the child tables' foreign keys point at those
**pairs**. PostgreSQL then refuses any row whose `course_id` disagrees with its
parent's, and `on update cascade` rewrites children when a module moves.

Two things fall out of this:

- The enrollment check in the hottest RLS policy reads one column instead of
  joining two tables on every row scanned.
- A lesson from one course **cannot** be tagged with a topic from another. No
  trigger to forget, no application check to bypass — no such row satisfies
  both foreign keys.

### Ordering, and why `position` is deferrable

`modules (course_id, position)` and `lessons (module_id, position)` are unique
but **deferrable**. Reordering rewrites several rows and necessarily passes
through a state where two share a position; deferring the check to COMMIT lets
a reorder be the obvious set of UPDATEs in one transaction instead of a dance
with sentinel values.

The cost, which is easy to hit: PostgreSQL refuses a deferrable constraint as
an `ON CONFLICT` arbiter, so an upsert on `modules` must arbitrate on the
primary key. `supabase/seed.sql` does exactly that.

### Topics

The examination blueprint is transcribed from Pearson VUE publication
**#124401**, *Texas Insurance Supplement — Examination Content Outlines*
(effective 1 September 2026). For General Lines Property & Casualty it is
**130 scored questions** — 100 general knowledge across six sections, 30 Texas
statutes across two — and 145 including pretest questions.

It publishes **question counts, not percentages**, which is why
`topics.question_count` exists and why percentages are derived for display
rather than stored. Second-hand summaries of this document disagree with each
other, so transcribe from #124401 itself.

The blueprint taxonomy is **orthogonal to modules**. A module is how we teach;
a topic is how the state tests. Conflating them makes topic-level scoring
impossible later — a readiness score could only say "you are weak on chapter
4", which is a fact about our book rather than about the exam.

Topics nest at most one level, enforced by `enforce_topic_depth()`. Combined
with the `topics_no_self_parent` check, that makes cycles impossible — which
matters because the readiness calculation walks the taxonomy, and a cycle would
be an infinite loop reachable by anyone who can author content.

### Markdown

Lesson bodies are Markdown, parsed by `lib/markdown.ts` into a **typed node
tree** and rendered as React elements by `components/Markdown.tsx`. The parser
never produces an HTML string and the render path contains no
`dangerouslySetInnerHTML`, so author text is escaped by React. Raw HTML in a
body renders as literal text; link hrefs are checked against a scheme
allow-list.

This is an allow-list rather than the usual parser-plus-sanitiser deny-list. A
bug in this parser produces ugly output; a misconfigured sanitiser produces
cross-site scripting.

---

## Row-Level Security

RLS is enabled on every table **in migrations**. A table with RLS enabled
and no matching policy denies everything, which is the correct default.

### `profiles`

| Policy                   | Operation | Rule                        |
| ------------------------ | --------- | --------------------------- |
| `profiles_select_own`    | SELECT    | `id = auth.uid()`           |
| `profiles_select_admin`  | SELECT    | `public.is_admin()`         |
| `profiles_update_own`    | UPDATE    | own row, in USING and WITH CHECK |
| `profiles_update_admin`  | UPDATE    | `public.is_admin()`         |

No INSERT policy (rows come from the auth trigger) and no DELETE policy (rows
cascade from `auth.users`). `anon` holds no privileges on this table at all.

### `courses`

| Policy                  | Operation | Rule                                  |
| ----------------------- | --------- | ------------------------------------- |
| `courses_select_active` | SELECT    | `status = 'active'` — `anon` and `authenticated` |
| `courses_select_admin`  | SELECT    | `public.is_admin()`                   |
| `courses_insert_admin`  | INSERT    | `public.is_admin()`                   |
| `courses_update_admin`  | UPDATE    | `public.is_admin()`                   |
| `courses_delete_admin`  | DELETE    | `public.is_admin()`                   |

Active courses are the public catalogue — marketing copy, no student data — so
anonymous visitors can read them and `/courses` works signed out. Draft and
archived courses are invisible to everyone but admins.

### `enrollments`

| Policy                      | Operation | Rule                      |
| --------------------------- | --------- | ------------------------- |
| `enrollments_select_own`    | SELECT    | `student_id = auth.uid()` |
| `enrollments_select_admin`  | SELECT    | `public.is_admin()`       |
| `enrollments_insert_admin`  | INSERT    | `public.is_admin()`       |
| `enrollments_update_admin`  | UPDATE    | `public.is_admin()`       |
| `enrollments_delete_admin`  | DELETE    | `public.is_admin()`       |

**Students cannot self-enroll in Phase 1.** There is intentionally no student
INSERT/UPDATE/DELETE policy — a permissive one would let anyone grant themselves
free access to every course. Enrollment will be granted by the checkout and
admin flows in a later phase, where it can be tied to a payment or an explicit
administrative action.

### How role escalation is prevented

Four independent layers, in order of what stops an attacker first:

1. **Column-level privileges.** `authenticated` is granted
   `UPDATE (first_name, last_name)` on `profiles` and nothing else, so
   `update profiles set role = 'admin'` is rejected by the privilege system
   before RLS is even consulted. This applies to admins too: an admin's browser
   session also connects as `authenticated`.
2. **An immutability trigger.** `enforce_profile_immutable_columns()` is a
   `BEFORE UPDATE` trigger that rejects changes to `id`, `created_at`, `email`
   and (for non-admins) `role`. RLS alone cannot express this, because an UPDATE
   policy's `WITH CHECK` clause only sees the new row and cannot compare it to
   the old one. This is the backstop if a future migration widens the grants.

   It is deliberately **SECURITY INVOKER**. Declaring it `SECURITY DEFINER`
   rebinds `current_user` to the function's owner (`postgres`), which matches
   its trusted-role allow-list on every call and silently turns the whole
   trigger into a no-op — a mistake this project made once and now tests for
   explicitly (assertions `T1`–`T8`, which widen the column GRANT so that
   execution actually reaches the trigger).
3. **The signup trigger.** `handle_new_user()` hard-codes
   `role = 'student'`. It reads only `first_name` and `last_name` out of the
   client-controlled signup metadata, trimmed and length-capped. Metadata
   claiming `role: 'admin'` has no effect — there is a test for exactly this.
4. **No UI.** The signup form has no role selector and the profile form renders
   the role as read-only text, not as an input.

### The `is_admin()` helper

```sql
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = ''
```

It exists so policies can ask "is the caller an admin?" without a policy on
`profiles` that selects from `profiles` — which would recurse.

Why `SECURITY DEFINER` is safe here:

- It reads one column of one table and returns a boolean. It never returns row
  data and takes no free-form input that reaches SQL.
- `set search_path = ''` means every name is resolved schema-qualified at
  definition time, so a caller cannot shadow `profiles` with an object in a
  schema they control.
- It is `stable` — it cannot write anything.
- Its only parameter is a uuid, defaulting to `auth.uid()`. Passing someone
  else's id leaks nothing: the answer is "that user is an admin", not any of
  their data.
- `EXECUTE` is revoked from `PUBLIC` and granted only to `authenticated` and
  `service_role`, so anonymous visitors cannot call it.

A student cannot use it to gain anything, because it only reads. The write path
for `role` is closed separately, by the four layers above.

---

## Authentication

**Signup** (`/signup`) collects first name, last name, email, password and
password confirmation. There is no role selector — every public registration is
a student. The form calls `supabase.auth.signUp()` with only the two name
fields as metadata; the database trigger creates the profile and sets the role.
When email confirmation is enabled, the user sees a deliberately non-committal
"if that address can be registered…" screen, so the page cannot be used to
discover whether an account already exists.

**Login** (`/login`) calls `signInWithPassword()`. Errors are normalised so that
a wrong password and an unknown address produce the identical message —
otherwise the form becomes an account-enumeration oracle. A `?next=` parameter
is honoured but validated first: only same-origin absolute paths are accepted,
so the login page can never be turned into an open redirect.

**Logout** is a form `POST` to `/auth/signout`, which calls `signOut()` to revoke
the refresh token server-side and clear the cookies. It is POST-only (a `GET`
returns 405) so a prefetch, a crawler or a third-party `<img>` tag cannot sign a
user out.

**Sessions** are stored in cookies by `@supabase/ssr` and refreshed on every
request by `proxy.ts`. Server Components cannot write cookies, so without that
refresh a user would be silently signed out mid-session.

**Route protection** has three layers:

1. `proxy.ts` redirects anonymous requests for `/dashboard/**` and `/admin/**`
   to `/login?next=<path>`. This is a UX convenience, not the boundary.
2. Every protected layout and page calls `requireAuth()` / `requireAdmin()` from
   `lib/auth.ts`, which run on the server and cannot be skipped by a client.
   They use `supabase.auth.getUser()`, which revalidates the token with the Auth
   server — never `getSession()`, which only decodes a cookie.
3. Row-Level Security. Even if both layers above were bypassed, every query
   would return only the caller's own rows.

Nothing trusts a role from `localStorage`, a browser-set cookie, a URL
parameter, or a client-submitted form field.

---

## Admin

`/admin` requires an authenticated user whose `profiles.role` is `admin`, read
from the database on every request. A signed-in non-admin gets an "Access
denied" page and none of the admin children are ever rendered or shipped to the
browser. Hiding the "Admin" link in the header is cosmetic only.

**Do not attempt to make yourself an admin from the client.** It cannot work —
the `authenticated` database role holds no UPDATE privilege on `profiles.role`.

### Promoting the first administrator

Role changes are deliberately an out-of-band operation. Register the account
through the normal signup form first, then run this once in the **Supabase
Dashboard → SQL Editor** (which executes with privileged credentials):

```sql
update public.profiles
   set role = 'admin'
 where lower(email) = lower('person@example.com');
```

Verify it:

```sql
select email, role from public.profiles where role <> 'student';
```

The same statement works from a trusted server-side script using the
service-role key. It must never be reachable from the browser.

---

## Testing

```bash
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck    # tsc --noEmit
npm test             # Vitest: unit, component and Server Component tests
npm run build        # production build
npm run check        # all four, in order
```

### Continuous integration

`.github/workflows/texas-exam-prep.yml` runs on every push and pull request
that touches `texas-exam-prep/` — and only then, so commits to the unrelated
`medcheck` app at the repository root never trigger it.

Two jobs:

| Job | What it does |
| --- | ------------ |
| **Lint, types, tests, build** | `npm ci`, then lint, typecheck, the Vitest suite, and a production build. The build runs with **no** Supabase credentials on purpose: it must succeed without them, and a build that only passed with secrets present would hide the unconfigured-state handling. |
| **Database schema and RLS policies** | Boots a real PostgreSQL 16 service container, applies the shim and every migration from scratch, and runs both RLS assertion suites as an unprivileged `authenticated` connection. Plus an explicit guard on the `SECURITY DEFINER` / `INVOKER` mode of every function in the schema. |

The second job is the important one. The RLS suite is what proves a student
cannot read another student's data or promote themselves, and before CI it only
ran when somebody remembered to run it.

### Database and RLS verification

Two suites cover the same guarantees; run whichever your environment supports.

**With the Supabase CLI and Docker:**

```bash
npx supabase test db      # runs supabase/tests/rls_phase1_test.sql (pgTAP)
```

**Without Docker**, against any plain PostgreSQL 15+ server:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./scripts/test-rls-local.sh
```

The script creates a throwaway database, applies
`supabase/tests/local/00_supabase_shim.sql` (which recreates just the Supabase
pieces the migrations depend on — the four roles, `auth.users`, `auth.uid()`,
and Supabase's default grants), applies every migration in order, then runs
every `*_assertions.sql` suite in `supabase/tests/local/`. Any failed assertion
aborts with a non-zero exit code.

The runner also enforces a **floor on the number of assertions that report
success** (currently 119, overridable with `TEP_MIN_ASSERTIONS`). A green exit
code proves only that nothing raised — a suite that stopped executing part way,
or a file that stopped matching the glob, would also exit zero while proving
nothing. The floor is a minimum rather than an expected value, so adding
assertions never requires touching it; it trips only when assertions disappear,
which is the change nobody means to make.

The suites run against a schema with **no seed data**; each creates the rows it
needs. That matters because many assertions are counts — "an anonymous visitor
sees exactly one module" — and a count only means something when the suite owns
every row in the table. The seed is applied afterwards, purely to prove it
still loads.

Both suites execute as a real unprivileged `authenticated` connection with a JWT
subject set, exactly as PostgREST would, and cover:

1. Student A can read Student A's profile
2. Student A cannot read Student B's profile
3. Student A can update allowed profile fields
4. Student A cannot update their role to admin
5. Student A can read active courses
6. Student A cannot read draft courses
7. Student A can read their own enrollments
8. Student A cannot read Student B's enrollments
9. Student A cannot self-enroll or enroll anyone else
10. A non-admin cannot reach admin-protected functionality

plus the signup trigger's behaviour (including that metadata claiming
`role: 'admin'` is ignored), anonymous access limits, the unique and check
constraints, and that `service_role` — and only `service_role` — can promote a
user.

The content suite (`02_content_rls_assertions.sql`) additionally proves:

11. An anonymous visitor reads the syllabus and is refused `lesson_contents`
    by the privilege system, before RLS is consulted
12. A signed-in visitor with no enrollment reads zero lesson bodies
13. An enrolled student reads exactly the published bodies — not a draft
    lesson's, not one under a draft module, not one in a draft course
14. An **expired** or **cancelled** enrollment reads no bodies, while the
    syllabus stays readable
15. Unpublishing a module revokes access to its lessons' bodies
16. A lesson cannot be tagged with another course's topic, and a lesson cannot
    claim a course its module does not belong to
17. The topic tree cannot cycle or nest more than one level

### Mutation testing

The assertion suites were checked by breaking the schema on purpose and
confirming each break was caught — grants widened, policies replaced with
`using (true)`, RLS disabled, foreign keys and triggers dropped, and the
entitlement helpers rewritten to ignore expiry.

Two of those breaks were **not** caught on the first attempt, and both fixes
are worth knowing about:

- Reducing `lesson_is_published()` to check only the lesson's own status passed
  every end-to-end assertion, because a student calling it reads `lessons`
  through that table's RLS policy, which had *already* removed lessons under a
  draft module. The shallow function returned the right answer for the wrong
  reason. Assertions `I1`–`I5` now test the function directly, as the
  migration role, where no policy is filtering.
- A policy rewritten to `using (true)` on `lesson_topics` changed nothing,
  because the fixtures only tagged a lesson that was supposed to be visible.
  A visibility test needs at least one row that is supposed to be invisible.

---

## Future phases

Not implemented, and not to be started without an explicit decision:

- **Phase 2** — ~~course content schema~~ (done) and the admin authoring UI,
  which is the next piece of work
- **Phase 3** — the tagged question bank with **server-side-only answer
  keys**, lesson quizzes, exam blueprints
- **Phase 4** — timed practice exams and state-exam simulations, secure grading,
  topic-level scoring, mastery and readiness tracking, instructor tools
- **Phase 5** — reporting and analytics, platform settings
- **Later** — payments and subscriptions

### A constraint to preserve

Students must never be able to discover correct answers through developer tools,
network responses, page source, the client JavaScript bundle, or a direct
Supabase query. Nothing in Phase 1 ships answer data — but the architecture is
already shaped for it: answer keys will live in a table with **no** student-side
SELECT policy, grading will run in a `SECURITY DEFINER` function or a server
action that returns only a score, and no query builder that a browser can reach
will ever be pointed at the answer column.
