# Reseeding content and questions

What this does: pushes every lesson and every question from `content/` into
the live database. Run it after pulling changes that touched `content/`.

It is safe to run more than once. Every row is keyed by a UUID derived from
its own text, so a second run updates the rows it already wrote rather than
duplicating them.

## Before you start

Two different places take commands in this project, and putting one in the
other is the mistake that has cost the most time here:

- **TERMINAL** — the black window on your own machine, in the `insurance`
  folder. Everything below is terminal.
- **SUPABASE SQL EDITOR** — the web page. Nothing below goes there.

You need your database connection string from the Supabase dashboard:
**Connect → Session pooler**. Keep it out of chat, out of this repo, and out
of anything you paste to anybody. If it is ever exposed, reset the password
in the dashboard.

## 1. Get the latest content

```
cd ~/insurance
git pull origin main
```

## 2. Load it

`psql` will ask for the database password. It prints nothing while it works
and can sit quiet for a minute or two on `seed_questions.sql`, which is the
larger of the two. Quiet is normal. Do not interrupt it.

```
psql "<your session pooler connection string>" -v ON_ERROR_STOP=1 -f supabase/seed_content.sql
psql "<your session pooler connection string>" -v ON_ERROR_STOP=1 -f supabase/seed_questions.sql
```

`ON_ERROR_STOP=1` matters: without it psql shrugs off a failed statement and
keeps going, and you end up with a half-loaded course that looks fine.

## 3. Check it landed

```
psql "<your session pooler connection string>" -c "select (select count(*) from lessons) as lessons, (select count(*) from questions) as questions, (select count(*) from question_options) as options;"
```

Expected as of 2026-09-17:

| lessons | questions | options |
| ------- | --------- | ------- |
| 50      | 699       | 2796    |

If the numbers are lower, a file did not finish loading. Run that file again;
re-running is safe.

## What a student sees afterwards

Nothing new, until a module is signed off. The review gate publishes only what
carries a `REVIEWED by <name> on <date>` line, and a sign-off now records a
fingerprint of the words it signed, so a lesson edited afterwards goes back to
draft rather than publishing under a reviewer's name. Signing off a module:

```
node scripts/review-module.mjs --module 01 --reviewer "Your Name"
```

Then commit, push, and reseed again so the change reaches the database.
