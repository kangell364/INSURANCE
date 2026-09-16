# Question drafts

One Markdown file per lesson or topic, reviewed here and loaded into the
database once approved. The same discipline as `content/` for lessons, for the
same reason — prose is reviewable in a way SQL is not — and one reason more.

## Why the review gate matters more here than for lessons

**A lesson that is wrong misleads a student. A wrong answer key marks a
correct answer wrong.** The second is worse: the student will believe the
material over themselves, and un-learn something they had right.

So a question file carrying `UNREVIEWED` imports as `draft`, draft questions
are invisible to students, and a draft question is never drawn into a paper.

## Format

````
---
course: texas-general-lines-property-casualty
topic: GK.II
lesson: deductibles-coinsurance-and-limits
review: UNREVIEWED — drafted by Claude, not yet checked by a licensed producer
---

### A building worth $500,000 carries 80% coinsurance, a $300,000 limit and a
### $1,000 deductible. Fire causes $100,000 of damage. What is paid?

- [ ] $100,000
- [x] $74,000
- [ ] $75,000
- [ ] $99,000

Coinsurance applies before the deductible. Should = 80% x $500,000 =
$400,000; did = $300,000; 300/400 = 0.75; 0.75 x $100,000 = $75,000; less the
$1,000 deductible = $74,000.
````

- `topic` is the blueprint code, and it is **required** — an untagged question
  cannot be drawn into a paper, so it may as well not exist.
- `lesson` is optional. Set it for questions that follow one lesson, so the
  per-lesson quiz can find them.
- **Exactly one option carries `[x]`.** The importer refuses a question with
  none or with two: a question with no answer cannot be scored, and a question
  with two has an argument in it.
- The paragraph after the options is the **explanation**, shown only once the
  answer may be revealed. Write it as teaching, not as a verdict: *why* the
  answer is what it is.

## Writing rules

These are additional to `content/README.md`, which applies in full.

- **Never use a recalled or leaked exam question.** The candidate handbook
  describes exam-security monitoring and score cancellation; material built on
  stolen questions puts the business and its students at risk. Questions here
  are written from the blueprint and the primary sources, like the lessons.
- **Test the concept, not the wording.** A question answerable by spotting
  which option repeats a phrase from the lesson measures reading, not
  knowledge.
- **Distractors must be wrong for a reason.** The best wrong answer is the one
  a student gets by making a specific, common mistake — applying the
  deductible before coinsurance, or reading a per-person limit as
  per-accident. A distractor nobody would pick is a wasted option and narrows
  a four-option question to three.
- **Keep the options the same shape.** Differences in length, grammar or
  specificity are tells, and a student who learns to read the tells has
  learned nothing about insurance.
- **Cite the statute** in the explanation for anything in TX.I or TX.II, as
  the lessons do.
- **One idea per question.** A question that needs two unrelated facts cannot
  tell you which one the student was missing, which makes the topic score
  useless for drills.
