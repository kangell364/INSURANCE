# What is waiting for you

Ordered. Everything here needs a person; nothing here is blocked on code.

Last updated 16 September 2026.

---

## 1. Get yourself back in — 2 minutes

Signup and password reset both fail right now, and it is the same cause:
**both send an email, and email delivery is not configured.** Supabase returns
an error, the app now says so rather than "Something went wrong", but it still
cannot let you in.

**Supabase → Authentication → Providers → Email → turn "Confirm email" OFF.**

Signup then completes with no email at all. Turn it back on after step 2.

Alternative: Authentication → Users → **Add user**, tick **Auto Confirm
User**.

## 2. Configure SMTP — the launch blocker

Until this is done you cannot sell the course to anybody, because:

- a new customer's confirmation email will not arrive;
- anyone who forgets a password cannot get back in;
- **both fail silently**, and both land on somebody who has already paid.

**Supabase → Project Settings → Authentication → SMTP Settings.** Needs a
third-party sender — Resend, Postmark, SendGrid, Amazon SES. Free or a few
dollars a month at this volume.

Then **turn "Confirm email" back on** and test both paths from a real inbox: a
fresh signup, and a password reset. A misconfigured sender fails exactly as
silently as no sender at all.

Full detail in `DEPLOY.md`.

## 3. Review Module 1 — about 40 minutes

Seven lessons, ~8,000 words. **41 of 42 lessons are UNREVIEWED**, and nothing
publishes until a licensed producer has read it. This is now the only thing
between the platform and something sellable.

To read them as a student does, publish them for preview:

```sql
update public.lessons set status = 'active'
 where slug in (
   'risk-peril-and-hazard','how-insurance-works',
   'insurable-interest-and-indemnity','valuing-a-loss',
   'deductibles-coinsurance-and-limits','negligence-and-liability',
   'terms-the-other-lessons-assume');
```

That is a preview, not a publication — the files still say UNREVIEWED, so the
next seed regeneration resets them.

**To publish one properly**, edit its Markdown front matter in
`content/texas-general-lines-property-casualty/01-insurance-fundamentals/`:

```
review: Checked by Duane Angell, <date>
status: active
```

The `review:` line is the one that matters. `status: active` alone does
nothing while it still says UNREVIEWED.

Then `node scripts/import-content.mjs` and re-apply the content seed.

**Read Module 5 hardest.** The general-knowledge modules cover concepts that
have been taught the same way for decades. Module 5 turns on specific Texas
statutes, and that is where a plausible-sounding error does real damage.

## 4. Download the Tier 1 statutes — 10 minutes, no rush

Seven files, listed with direct links in `docs/statutes-to-download.md`. They
unblock the remaining third of Module 5: continuing education, the Guaranty
Association, the minimum liability limits, workers' compensation and TAIPA.

Save them with the code prefix — `IN.4004.pdf`, `TN.601.pdf`, `LA.408.pdf` —
because the exam cites **Insurance Code 401 and Labor Code 401**, which are
unrelated chapters.

## 5. Install psql — worth doing once

The content seed is ~380 KB and is regenerated every time a lesson is
reviewed. Through the SQL editor that is 19 pastes, every time. With psql it
is one command:

```
psql "<connection string from Supabase → Settings → Database>" \
  -f supabase/seed.sql -f supabase/seed_content.sql
```

---

## Not waiting on you

The question bank and exam screens. The Phase 3 schema is built and tested —
questions, options, an answer key no browser can read, attempts and scoring —
but there are no questions in it and no UI on top. That is the next large
piece of work and none of it needs you.
