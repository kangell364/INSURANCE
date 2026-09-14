# Texas Insurance Exam Prep Platform

Exam preparation for Texas insurance licensing examinations, beginning with the
**Texas General Lines Property & Casualty** exam.

The platform is being built for candidates — mostly working adults — who need
structured coursework, topic-tagged practice, and full-length timed exam
simulations, plus the instructor and administrator tooling to run all of it.

---

## Current phase

**Phase 1 — application foundation.** This is the only phase implemented.

Phase 1 delivers:

- A Next.js App Router application in TypeScript with Tailwind CSS
- Supabase Postgres schema, delivered as version-controlled migrations
- Row-Level Security on every application table, written in migrations
- Supabase Auth: signup, login, logout, session persistence
- Server-validated protected student routes and a database-validated admin route
- A basic student dashboard, My Courses page and profile editor
- An admin shell with placeholder navigation for later phases
- Automated database/RLS tests and an application test suite

Phase 1 deliberately does **not** include: course content, modules, lessons,
quizzes, the question bank, the exam simulator, scoring, reporting, or payments.
Where the UI shows a section for one of those, it is explicitly labelled as
upcoming rather than populated with invented data.

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

## Row-Level Security

RLS is enabled on all three tables **in migrations**. A table with RLS enabled
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
   the old one. This is a backstop in case a future migration widens the grants.
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
`supabase/tests/local/01_rls_assertions.sql`. Any failed assertion aborts with a
non-zero exit code.

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

---

## Future phases

Not implemented, and not to be started without an explicit decision:

- **Phase 2** — course content schema and authoring: modules, lessons, ordering,
  and the admin authoring UI
- **Phase 3** — topics, the tagged question bank with **server-side-only
  answer keys**, lesson quizzes, exam blueprints
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
