# Texas General Lines Property & Casualty — Exam Prep

A study platform for the Texas General Lines Property & Casualty insurance
licensing examination. Next.js 16, React 19, TypeScript, Tailwind v4, Supabase.

## Where this came from

This application previously lived in a `texas-exam-prep/` subdirectory of
`kangell364/medcheck`, beside an unrelated medication-reminder app. It was
moved here with `git subtree split`, so **the full commit history came with
it** — every commit before the move shows paths under `texas-exam-prep/`.

Nothing in `kangell364/medcheck` is part of this project any more.

## What is here

| | |
| --- | --- |
| `app/` | Next.js routes — marketing, auth, dashboard, admin |
| `content/` | The lessons, as Markdown. **The source of truth for course content.** |
| `lib/` | Data access, the Markdown parser, domain logic |
| `supabase/migrations/` | Schema, grants and RLS policies |
| `supabase/tests/local/` | 139 RLS assertions, run against a real PostgreSQL |
| `supabase/deploy/` | Paste-ready SQL for the Supabase editor, and `preflight.sql` |
| `reference/statutes/` | 30 chapters of the Texas Insurance Code, as text |
| `docs/` | Verified exam facts, market research, source gaps |
| `scripts/` | Content importer, statute extractor, test harnesses |

## Working on it

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # lint, typecheck, tests, build
```

Editing a lesson means editing the Markdown in `content/`, then:

```bash
node scripts/import-content.mjs      # regenerates supabase/seed_content.sql
```

**A lesson whose front matter still says `UNREVIEWED` is written out as a
draft whatever its `status` field claims**, and RLS hides drafts from students
entirely, body included. That is deliberate and is enforced by the importer
and asserted in CI. See `content/README.md`.

## Deploying

`DEPLOY.md` is the runbook: how to tell what state the database is in, how to
apply the schema, how to load the content, and why nothing appears on the site
until a lesson has actually been reviewed.
