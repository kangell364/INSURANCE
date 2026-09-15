# Phase 2 — Course content and question bank: design

**Status: partly implemented.** Step 1 of the build order (sections 2 and 3 —
modules, lessons, topics and their policies) is built, tested and shipped. The
question bank and assessment sections remain a proposal.

All four open questions are now settled; each is marked **Decision** in place
below, with the reasoning kept rather than deleted so the next person can see
what was traded away.

This document exists to settle the shape of the content and assessment schema
*before* any of it is built, because two decisions in it are expensive to
reverse:

1. how the question bank is protected from the students taking the exam, and
2. whether a question can be edited after somebody has answered it.

Phase 1 (`profiles`, `courses`, `enrollments`, RLS, auth) is the foundation this
builds on. Read `README.md` first.

---

## 1. The constraint that shapes everything

From the original brief:

> Students must eventually be unable to discover correct answers through:
> browser developer tools, network responses, page source, direct Supabase
> queries, client JavaScript bundles.

That last one — **direct Supabase queries** — is the hard constraint, and it
rules out the obvious design.

Supabase exposes every table in the `public` schema as a REST endpoint. A
student's anon key and JWT are in their browser; they can issue any request the
`authenticated` role is permitted to make. So if a student's session can read
the questions table at all, they can read *all of it*, at their leisure, with
`curl`. RLS can restrict which **rows** come back, but "only the rows in the
attempt you are currently sitting" is not a condition RLS can express cheaply or
safely, and one mistake in that policy exposes the entire bank permanently.

### The decision

**The question bank is not a REST resource for students.**

`questions`, `question_options` and `question_answers` get **no grants at all**
to `anon` or `authenticated`. Not a restrictive policy — no privilege. A student
hitting `/rest/v1/questions` gets a permission error, no matter what their JWT
says or what filters they pass.

Students reach questions through exactly one door: a `SECURITY DEFINER` function
that returns the sanitised payload for an attempt they own. That function is the
only code that can see the answer key, and it never returns it.

```
  Student's browser
        │
        │  supabase.rpc('get_attempt_questions', { attempt_id })
        ▼
  public.get_attempt_questions()          ← SECURITY DEFINER, the only door
        │  · verifies the attempt belongs to auth.uid()
        │  · verifies it is still in progress and not expired
        │  · returns stem + options, WITHOUT is_correct
        ▼
  questions / question_options            ← no grants to authenticated
  question_answers                        ← no grants to authenticated
```

Grading works the same way in reverse: the client submits chosen option ids,
and `submit_attempt()` computes the score server-side and stores it. The answer
key never crosses the network.

### Why `is_correct` lives in its own table

It would be simpler to put an `is_correct boolean` column on `question_options`
and revoke `SELECT` on just that column. That works, but it fails open in two
ways worth avoiding:

- A `select=*` from any future code path silently returns it the moment someone
  widens the grant — the same class of mistake as the Phase 1 trigger bug.
- Anyone reading the table definition sees the secret sitting next to the
  public data, which invites exactly that mistake.

A separate `question_answers` table makes the boundary obvious in the schema
itself, and means the grant surface for the secret is a whole table rather than
a column that has to be remembered.

**Both defences are used**: separate table *and* no grants. Phase 1's lesson
was that a single layer described as two is worse than a single layer that
everyone knows is single.

---

## 2. Content hierarchy

```
  course  (Phase 1)
    └── module          ordered within the course
          └── lesson    ordered within the module
                └── lesson_quiz → questions
```

### `modules`

| Column       | Type              | Notes                                |
| ------------ | ----------------- | ------------------------------------ |
| `id`         | uuid PK           |                                      |
| `course_id`  | uuid → `courses`  | on delete cascade                    |
| `title`      | text              | 1–200 chars                          |
| `description`| text, null        |                                      |
| `position`   | integer           | ordering within the course           |
| `status`     | `content_status`  | `draft` / `active` / `archived`      |
| timestamps   |                   | `created_at`, `updated_at`           |

`unique (course_id, position)` — deferrable, so a reorder can shuffle several
rows inside one transaction without tripping the constraint mid-flight.

### `lessons`

| Column       | Type              | Notes                                   |
| ------------ | ----------------- | --------------------------------------- |
| `id`         | uuid PK           |                                         |
| `module_id`  | uuid → `modules`  | on delete cascade                       |
| `title`      | text              |                                         |
| `slug`       | text              | unique per module, for readable URLs    |
| `body`       | text              | see the authoring-format question below |
| `position`   | integer           | ordering within the module              |
| `status`     | `content_status`  |                                         |
| `estimated_minutes` | integer, null | shown to students planning a session |

**Decision (A) — Markdown. IMPLEMENTED.**

The body is Markdown, rendered by `lib/markdown.ts`.

What was built is narrower than "Markdown", and deliberately so. It is a small
parser that produces a typed node tree — never an HTML string — which
`components/Markdown.tsx` renders as React elements. Author text therefore
reaches the page as JSX text children and React escapes it; there is no
`dangerouslySetInnerHTML` anywhere in the path.

This was chosen over `marked` plus a sanitiser because that pairing is a
**deny-list**: the parser emits whatever HTML the source contains and a second
package is configured to strip the dangerous parts. Its safety depends on that
configuration staying correct across upgrades of two packages. The parser here
is an **allow-list** — it can only emit the handful of node types it defines —
so a bug in it produces ugly output rather than executable markup.

The cost is coverage: no tables, no images, no raw HTML (it renders as literal
text). Tables and images are the two most likely to be wanted for insurance
content, and both should be added as new node types rather than by swapping in
a general-purpose parser.

**The body also does not live on `lessons`.** It is in `lesson_contents`, a
separate table, because lesson metadata is the public syllabus and the body is
the paid product — and no single row can be both. See the migration
`20260201000200_lessons.sql` for the full argument.

---

## 3. Topics — the exam blueprint taxonomy

Topics are **orthogonal to modules and lessons**. A module is how you *teach*;
a topic is how the state *tests*. Conflating them is the mistake that makes
topic-level scoring impossible later.

### `topics`

| Column            | Type                | Notes                                  |
| ----------------- | ------------------- | -------------------------------------- |
| `id`              | uuid PK             |                                        |
| `course_id`       | uuid → `courses`    |                                        |
| `parent_topic_id` | uuid → `topics`, null | one level of nesting is enough        |
| `code`            | text                | e.g. `P&C.03.02`, unique per course    |
| `name`            | text                |                                        |
| `question_count`  | integer, null       | scored questions the blueprint assigns |
| `blueprint_weight`| numeric, null       | published % weighting, where given     |

**Counts, not percentages.** This was written assuming blueprints publish
percentage weightings. The Texas one does not: Pearson VUE publication
#124401 assigns each section a number of scored questions.

| Section                                              | Questions |
| ---------------------------------------------------- | --------- |
| GK.I Types of Policies                               | 22        |
| GK.II Insurance Terms and Related Concepts           | 15        |
| GK.III Policy Provisions and Contract Law            | 13        |
| GK.IV Types of Policies, Bonds, and Related Terms    | 23        |
| GK.V Insurance Terms and Related Concepts (Casualty) | 15        |
| GK.VI Policy Provisions (Casualty)                   | 12        |
| TX.I Texas Statutes and Rules Common to P&C          | 18        |
| TX.II Texas Statutes and Rules Pertinent to P&C      | 12        |
| **Total scored**                                     | **130**   |

145 including pretest questions. `question_count` therefore holds the primary
figure and any percentage is derived: 22 of 130 is 16.923…%, which a
`numeric(5,2)` cannot round-trip, and the Phase 3 paper generator needs "draw
22 questions from this topic" rather than a percentage it must multiply and
round back — where eight roundings can easily miss the exam length.

`blueprint_weight` is kept for blueprints genuinely published as percentages.
Where both exist the count wins, consistently, in every screen.

`lesson_topics (lesson_id, topic_id)` — many-to-many, so "which lessons should I
review for my weakest topic?" is answerable. This is what turns a readiness
score into an actionable next step rather than a number.

---

## 4. The question bank

### `questions`

| Column        | Type                | Notes                                        |
| ------------- | ------------------- | -------------------------------------------- |
| `id`          | uuid PK             |                                              |
| `course_id`   | uuid → `courses`    |                                              |
| `topic_id`    | uuid → `topics`     | every question is tagged — not nullable      |
| `stem`        | text                | the question itself                          |
| `kind`        | `question_kind`     | `single_choice` / `multi_choice` / `true_false` |
| `difficulty`  | smallint, null      | 1–5, for balancing a paper                   |
| `status`      | `content_status`    | only `active` questions can be served        |
| `version`     | integer             | see the versioning question below            |

### `question_options`

`id`, `question_id`, `body`, `position`. **No correctness flag.**

### `question_answers`  ← the secret

| Column       | Type                        | Notes                        |
| ------------ | --------------------------- | ---------------------------- |
| `question_id`| uuid → `questions`          |                              |
| `option_id`  | uuid → `question_options`   |                              |
| `is_correct` | boolean                     |                              |
| `rationale`  | text, null                  | why this option is right/wrong |

Primary key `(question_id, option_id)`.

`rationale` lives here deliberately: an explanation of *why* an answer is right
gives the answer away, so it is exactly as secret as `is_correct` and must not
be released until an attempt is submitted.

**Open question (B) — versioning.** If an instructor fixes a typo in a question
that 500 students have already answered, do their historical results still mean
anything? Two options:

- **Immutable questions.** Editing an `active` question creates a new row and
  archives the old one; attempts reference the exact version answered. Honest
  history, more storage, more authoring friction.
- **Mutable questions.** Simpler to author; historical scores silently refer to
  text that no longer exists.

**Decision (B) — immutable once answered.** Not yet implemented; it lands with
the question bank.

A question is freely editable until the first attempt references it. From that
point an edit creates a new row and archives the old one, and attempts point at
the exact version answered. It costs one `version` column and a check in the
authoring path, and it is the difference between a defensible score history and
a misleading one.

This matters more here than in most products: the thing being sold is a
prediction about whether someone will pass a real exam. A prediction computed
from answers to questions that no longer exist is not a prediction.

---

## 5. Assessment

### `exam_blueprints` and `blueprint_topics`

A blueprint is a recipe for generating a paper:

`exam_blueprints`: `id`, `course_id`, `name`, `kind` (`practice` / `simulation`),
`time_limit_minutes`, `question_count`, `pass_percentage`, `status`.

`blueprint_topics`: `blueprint_id`, `topic_id`, `question_count` — how many
questions this topic contributes. The sum should equal the blueprint's
`question_count`; enforce with a trigger rather than hoping.

This is what makes a simulation actually mirror the state exam: the weightings
are data, not code, and can be corrected when TDI republishes the blueprint.

### `attempts`

| Column         | Type                   | Notes                                     |
| -------------- | ---------------------- | ----------------------------------------- |
| `id`           | uuid PK                |                                           |
| `student_id`   | uuid → `profiles`      |                                           |
| `course_id`    | uuid → `courses`       |                                           |
| `blueprint_id` | uuid, null             | null for a lesson quiz                    |
| `lesson_id`    | uuid, null             | set for a lesson quiz                     |
| `status`       | `attempt_status`       | `in_progress` / `submitted` / `expired` / `abandoned` |
| `started_at`   | timestamptz            | **server clock**                          |
| `expires_at`   | timestamptz, null      | **server-computed** at start              |
| `submitted_at` | timestamptz, null      |                                           |
| `score_percent`| numeric, null          | written only by the grading function      |
| `passed`       | boolean, null          |                                           |

`attempt_questions`: `attempt_id`, `question_id`, `position` — the paper is
**frozen at start**, so a student cannot reroll for easier questions by
refreshing, and so results stay reproducible.

`attempt_responses`: `attempt_id`, `question_id`, `selected_option_ids` (array,
to support multi-select), `answered_at`, `is_correct` (null until graded).

### Timing

`expires_at` is computed server-side from `started_at + time_limit_minutes` and
never accepted from the client. `submit_attempt()` refuses responses that arrive
after it, and a scheduled job (or a lazy check on read) marks abandoned attempts
`expired`. A client-side timer is a courtesy to the student, never the
authority.

---

## 6. Row-Level Security plan

| Table | `anon` | student (`authenticated`) | admin / instructor |
| ----- | ------ | ------------------------- | ------------------ |
| `modules` | – | SELECT where course active **and enrolled** | full |
| `lessons` | – | SELECT where enrolled and module active | full |
| `topics` | – | SELECT for enrolled courses | full |
| `lesson_topics` | – | SELECT for enrolled courses | full |
| `questions` | **no grant** | **no grant** | SELECT/write (admin only) |
| `question_options` | **no grant** | **no grant** | SELECT/write (admin only) |
| `question_answers` | **no grant** | **no grant** | SELECT/write (admin only) |
| `exam_blueprints` | – | SELECT (name, limits) for enrolled courses | full |
| `blueprint_topics` | **no grant** | **no grant** | full |
| `attempts` | – | SELECT/INSERT own; no UPDATE (functions only) | SELECT all |
| `attempt_questions` | – | via RPC only | SELECT all |
| `attempt_responses` | – | SELECT own; INSERT/UPDATE own while `in_progress` | SELECT all |

Two policies worth calling out:

- **`attempt_responses.is_correct`** must not be readable while the attempt is
  `in_progress`, or a student learns each answer as they go and can change it.
  The policy gates on the parent attempt's status:

  ```sql
  using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id
        and a.student_id = (select auth.uid())
        and a.status <> 'in_progress'
    )
  )
  ```

  During the attempt, the student reads their *selections* but not their
  correctness. Post-submission review is a separate, intentional release.

- **`attempts` has no student UPDATE policy.** Status, score and timestamps are
  written only by the `SECURITY DEFINER` functions. A student who could
  `UPDATE attempts SET status='submitted', score_percent=100` has beaten the
  system without touching a question.

`blueprint_topics` is closed to students because the per-topic question counts
tell them the paper's exact composition.

### Enrollment as the gate

Every student-visible content policy above hangs off "is this student enrolled
in this course?". That deserves one helper rather than eleven copies of the same
subquery:

```sql
create or replace function public.is_enrolled(course uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = uid and e.course_id = course
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  );
$$;
```

Same safety argument as Phase 1's `is_admin()`: returns a boolean, reads one
table, `search_path` pinned, EXECUTE granted narrowly. **And — per the Phase 1
bug — it must be verified that it is actually reached**, not merely present.

---

## 7. The functions students may call

Only three, all `SECURITY DEFINER`, all narrowly scoped:

| Function | Does | Returns |
| -------- | ---- | ------- |
| `start_attempt(blueprint_id \| lesson_id)` | Checks enrollment, checks any retake limit, selects questions per the blueprint, freezes them into `attempt_questions`, sets `started_at`/`expires_at` from the server clock | attempt id |
| `get_attempt_questions(attempt_id)` | Verifies ownership + `in_progress` + not expired | stems and options, **no correctness** |
| `submit_attempt(attempt_id)` | Verifies ownership, refuses if expired, grades against `question_answers`, writes score and per-response `is_correct`, sets `submitted_at` | score summary |

Saving an in-progress answer can be a plain `INSERT`/`UPDATE` on
`attempt_responses` under RLS — it needs no elevated privilege, and keeping it
out of the functions keeps them small.

**Decision (C) — unlimited retakes; readiness from RECENT performance.**
Not yet implemented; it lands with attempts.

Attempts are not capped and there is no cooling-off period. Capping retakes
would penalise the exact behaviour the product exists to encourage, and a
student who wants to sit twenty practice exams the week before their test is a
student who is using it correctly.

The cap goes somewhere else instead: **readiness is computed from a rolling
window of recent attempts, never from a best-ever score.** Those are not
equivalent. "Highest you ever scored" can be reached by retaking one paper
until the answers are memorised, at which point the product congratulates a
student for recall of our question bank rather than command of the material —
and then they fail a $50 exam having been told they were ready. Recent
performance, preferably weighted towards questions not seen lately, cannot be
farmed the same way.

Concretely, `start_attempt` imposes no limit, and the readiness calculation
takes a window rather than a maximum.

---

## 8. Progress and readiness

- `lesson_completions`: `student_id`, `lesson_id`, `completed_at`. Student may
  insert their own; that is the one place self-service writes are safe, because
  claiming you read a lesson grants nothing.
- **Topic mastery** is derived, not stored: aggregate `attempt_responses` joined
  to `questions.topic_id` over submitted attempts. Start as a view; promote to a
  materialised view or summary table only when it is measurably slow. Storing a
  derived score invites it drifting from the responses it claims to summarise.
- **Readiness** is a deliberate formula, not an average — it should weight
  recent performance, topic coverage and blueprint weightings. Worth writing
  down and version-stamping, so a student's readiness can be explained.

**Decision (D) — 80%, shown as three bands. IMPLEMENTED** as the constants and
scale in `lib/readiness.ts`; the calculation that feeds it is still to come.

| Score   | Band          | What the student is told                  |
| ------- | ------------- | ----------------------------------------- |
| 0–64%   | Not ready     | Keep working; here are your weakest topics |
| 65–79%  | Getting there | Close; focus on weak topics, not retakes   |
| 80–100% | Ready to book | Book the state examination                 |

**Why 80 and not 70.** The state examination passes at 70%. Matching it would
mean a student who scrapes our bar has roughly even odds on the day, because
practice conditions are always kinder than a Pearson VUE testing centre — our
70% is not the state's 70%. Ten points of margin is what makes "you are ready"
a prediction rather than a hope.

**Why bands and not a number.** A bare percentage invites a student to grind it
up a point at a time. What they actually need is an answer to "should I book
yet", plus the list of topics holding them back. The bands give the first; the
topic breakdown gives the second.

The thresholds live in one module with a `SCALE_VERSION` constant. Any stored
readiness result must be stamped with that version: a score recorded under one
scale and displayed under another is a number that means nothing.

---

## 9. Suggested build order

Each step is independently shippable and testable.

1. ~~`modules`, `lessons`, `lesson_topics`, `topics` + RLS + admin read. Course
   content becomes visible; no assessment yet.~~ **DONE.** Six migrations, 62
   RLS assertions, the public syllabus page, the student course page and the
   lesson reader. `lesson_contents` was added to the plan during
   implementation — see decision A.
2. Lesson authoring UI in the admin shell (replaces the `Courses` / `Modules` /
   `Lessons` placeholders). **NEXT.** Content is currently authored in SQL.
3. Student lesson navigation ~~and~~ **(done)** plus `lesson_completions` — the
   first real progress.
4. Question bank tables with **zero student grants**, plus the admin authoring
   UI. No delivery path yet, so nothing to leak.
5. `start_attempt` / `get_attempt_questions` / `submit_attempt`, with RLS tests
   written *before* the UI.
6. Quiz and exam UI.
7. Topic mastery view and the readiness page.

---

## 10. What must be tested, and how

Phase 1 shipped two bugs that every test passed through. Both had the same
shape: **the test was satisfied by a layer in front of the thing under test.**
The question bank is where that pattern would be most costly, so the tests for
it need to be adversarial by construction:

- Assert that a student session **cannot** read `questions`, `question_options`
  or `question_answers` — directly, via a join, via an embedded PostgREST
  resource (`?select=*,question_answers(*)`), and via a view.
- Assert `get_attempt_questions` returns no correctness data, by inspecting the
  returned payload's keys rather than trusting the function body.
- Assert a student cannot call `get_attempt_questions` for **another student's**
  attempt, or for their own **after** it expires.
- Assert `submit_attempt` refuses a response submitted after `expires_at`.
- Assert a student cannot write `attempts.score_percent` directly.
- **Assert each guard is actually reached** — where one layer would mask
  another, temporarily remove the outer layer in the test, exactly as the Phase
  1 `T1`–`T8` assertions do.

---

## Decisions needed before building

| # | Question | Recommendation |
| - | -------- | -------------- |
| A | Lesson body format | Markdown |
| B | Question versioning | Immutable once answered |
| C | Retake policy | Needs a product decision |
| D | Readiness threshold | Needs a content-owner decision |

A and B I can proceed on unless you disagree. C and D are yours.
