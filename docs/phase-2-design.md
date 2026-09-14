# Phase 2 — Course content and question bank: design

**Status: proposal. Nothing here is implemented.**

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

**Open question (A):** what format is `body`? Markdown rendered at read time is
simplest and diffs well in migrations. Portable-text/JSON blocks are richer
(callouts, tables, embedded question previews) but need an editor. My
recommendation is **Markdown**, with a small set of custom fenced blocks if
needed later. Sanitise on render regardless — lesson bodies are authored by
instructors, not the public, but an instructor account is still not a reason to
allow arbitrary HTML.

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
| `blueprint_weight`| numeric, null       | the published % weighting, if any      |

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

My recommendation: **immutable once an attempt references it**, mutable before
that. It costs one `version` column and a check in the authoring path, and it is
the difference between a defensible score history and a misleading one.

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

**Open question (C) — retakes.** Unlimited? Capped per blueprint? Cooling-off
period? This affects `start_attempt` and whether readiness uses the best, the
latest, or a rolling average of attempts. It is also a commercial decision, not
only a technical one.

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

**Open question (D):** what readiness number does a student have to hit before
the product says "book the exam"? That is a pedagogical and reputational call,
and it should be made by whoever owns the content, not inferred from code.

---

## 9. Suggested build order

Each step is independently shippable and testable.

1. `modules`, `lessons`, `lesson_topics`, `topics` + RLS + admin read. Course
   content becomes visible; no assessment yet.
2. Lesson authoring UI in the admin shell (replaces the `Courses` / `Modules` /
   `Lessons` placeholders).
3. Student lesson navigation and `lesson_completions` — the first real progress.
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
