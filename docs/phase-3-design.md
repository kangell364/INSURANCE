# Phase 3 — questions, attempts and readiness

Decisions taken 16 September 2026.

| Decision | Choice |
| -------- | ------ |
| Where questions come from | **Written here**, from the same primary sources as the lessons, under the same review gate |
| Practice formats | **All three** — full mock, per-lesson quiz, topic drill |
| Answer reveal | **Mock: at the end, always.** Quiz and drill: **the student chooses per attempt** |

---

## The requirement that shapes everything

From the original brief:

> Students must eventually be unable to discover correct answers through:
> browser developer tools, network responses, page source, direct Supabase
> queries, client JavaScript bundles.

Read that literally, because it is a schema requirement and not a UI one.
"Not visible in the network response" means **the answer key must never be
sent to the browser at all** — not hidden, not encoded, not encrypted with a
key the page also has. The browser is a hostile environment and every trick
that puts the answer there in some disguised form loses.

Note also that the app holds **no service-role key** (see `DEPLOY.md`), so
there is no privileged client to hide behind. Every query the app makes runs
as the signed-in user. The database itself has to be what withholds the
answer.

### The shape that follows

Three tables where one would be obvious:

| Table | Holds | Readable by a student? |
| ----- | ----- | ---------------------- |
| `questions` | stem, explanation, topic, status | **Yes** — when published and enrolled |
| `question_options` | the option text, its position | **Yes** — same condition |
| `question_answers` | **which option is correct** | **No. Not ever.** |

`question_answers` gets **no grant to `anon` or `authenticated` at all**, and
RLS on with no policy for them. A table with RLS enabled and no policy denies
everything, and a missing grant denies it earlier still: two independent
mechanisms, either of which alone is sufficient. `select * from
question_answers` from a browser token returns a permission error, not an
empty set.

Splitting the options from the answer is what makes this possible. Keeping a
`is_correct boolean` on `question_options` would be the natural design and it
cannot be secured: **RLS decides which ROWS a caller sees, and column grants
decide which COLUMNS a ROLE may touch — neither can express "this role may
read these columns of this row but not those columns of the same row."**
That is the same reasoning that split `lesson_contents` from `lessons` in
Phase 2, applied one level deeper.

### How anything gets scored, then

A `SECURITY DEFINER` function, and this is the second deliberate one in the
project.

The Phase 1 post-mortem established that **`SECURITY DEFINER` must be
justified, not assumed** — `is_admin()` is the only other one, and it exists
to break RLS recursion on `profiles`. Here the justification is direct: the
caller must be able to *cause* a comparison against data they may not *read*.
That is precisely what definer rights are for, and there is no other way to
do it without a privileged client.

`score_attempt(attempt_id)`:

1. Runs as the owner, so it can read `question_answers`.
2. **Verifies the attempt belongs to `auth.uid()`** before anything else. A
   definer function that skips its own authorisation check is worse than no
   function, because it hands every caller the owner's privileges.
3. Refuses an attempt that is already submitted, so a score cannot be
   rewritten.
4. Writes `is_correct` per answered question and the totals on the attempt.
5. Returns the summary.

It never returns the correct option id for an unsubmitted attempt.

### The leak that is easy to miss

`attempt_questions.is_correct` **is itself the answer**, one bit at a time.
A student who answers, reads `is_correct`, and changes their mind has
defeated the whole design.

So `is_correct` is **null until the answer is allowed to be revealed**:

- **Mock** — written only at submission. During the attempt the column is null
  for every row, so there is nothing to read.
- **Quiz and drill in immediate mode** — written as each answer is recorded,
  because revealing it then is the point of that mode.
- **Quiz and drill in end mode** — as per the mock.

The reveal rule therefore lives in the database, next to the data, rather
than in a React component that a student can simply not run.

---

## Attempts

```
attempt_kind   : 'mock' | 'quiz' | 'drill'
reveal_mode    : 'immediate' | 'on_submit'
```

**A mock is always `on_submit`.** This is enforced by a check constraint, not
by the UI: a mock scored with instant feedback is not a measurement of
anything, and readiness is computed from mock attempts. Letting the client
choose would mean the readiness figure silently changes meaning depending on
a radio button.

Quizzes and drills accept either, per attempt, as decided.

### Drawing a paper

The blueprint publishes **counts, not percentages**, which is why
`topics.question_count` exists and why it is the primary figure (see
`docs/phase-2-design.md`). A mock draws **22 from GK.I, 15 from GK.II, 13 from
GK.III, 23 from GK.IV, 15 from GK.V, 12 from GK.VI, 18 from TX.I, 12 from
TX.II** — 130 scored questions, matching the real form.

Drawing by count avoids the rounding problem entirely: percentages would have
to be multiplied and rounded eight times, and eight roundings can easily miss
130.

**If a topic has fewer published questions than its count, the draw is short
and says so.** It does not silently substitute from another topic, because a
paper that quietly over-weights the topics we happen to have written is a
worse lie than a short paper that admits it.

---

## Readiness

`lib/readiness.ts` already carries the decisions: **80% ready, 65% almost**,
a three-band scale, `SCALE_VERSION` stamped on anything stored.

Two things restated because they are easy to erode:

**`STATE_PASS_MARK` does not exist and must not be reintroduced.** Texas
publishes no pass percentage — the reported score is an equated scaled score
and the cut score is not disclosed (see `docs/exam-facts.md`). A test asserts
the constant stays deleted.

**80% is a bar on our own material.** Copy may say "you are consistently
scoring well above our bar". It may not say "you would pass the state exam",
because that is a claim we cannot support.

Readiness is computed from **recent mock attempts**, per the retake decision:
unlimited retakes, readiness from recent performance rather than lifetime
average, so a candidate who has improved is not held down by their first
attempt.

---

## Review gate

Questions go through the same gate as lessons. A question whose source file
says `UNREVIEWED` imports as `draft`, and draft questions are invisible to
students and are never drawn into a paper.

The reasoning is stronger here than for lessons: **a lesson that is wrong
misleads a student, and a wrong answer key marks a correct answer wrong.**
The second is worse, because the student will believe the material over
themselves.
