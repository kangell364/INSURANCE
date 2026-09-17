# Backlog

Things worth building, not yet started. Ordered by what would move the
product most, not by effort.

---

## 1. Cram sheets

A one-page revision sheet per module, **generated from the lessons rather than
written**. Every lesson already bolds its key facts; a cram sheet is those
lines pulled out in order, with the statute citations they carry.

**Why it comes before flashcards.** Both serve recall of isolated facts. A
cram sheet needs a script and a page template; flashcards need a `cards`
table, a spaced-repetition scheduler, a review UI and their own review gate.
Same benefit for the figures — 30/60/25, 24 CE hours, the $300,000 guaranty
cap — at perhaps a tenth of the work, and it can ship before the first module
is even reviewed.

**It regenerates.** Edit a lesson, re-run the script, the sheet is current.
Nothing to keep in sync by hand, and no second place for a fact to go stale —
which matters, because a stale revision sheet is worse than none.

**It also inherits the review gate for free**, since it contains nothing a
lesson does not.

**What needs thought:** the bolded lines were written as emphasis inside
prose, not as standalone assertions. Some will not stand alone. The script
should probably flag those for a human rather than silently emit a fragment,
and the first run wants reading before anybody relies on it.

**Do not model it on anybody else's.** The idea of an end-of-unit condensation
is obvious and free; the selection and wording must come from our lessons.

## 2. A defined-before-used check

Tonight found the same defect nine times, and it is mechanical:

- **A term used as though already taught.** "First-party claim" in Module 5
  with the party numbering never explained. "Reinsurance" in three lessons,
  defined in none. "Risk retention group" inside a statutory list, nowhere
  else.
- **Worse: a term taught in the WRONG sense.** "Principal" existed only in
  suretyship, "participating" only as an NFIP community, "fiduciary" only as a
  bond. A student had exactly one association for each, and it pointed at the
  wrong relationship.

**The check:** extract every bolded term across the 50 lessons in reading
order, find each term's first use, and report any whose first use is not a
definition. Run it in CI.

**A second check, same family:** every term the lessons define should be the
CORRECT answer to at least one question. Two gaps tonight were "defined but
never the answer" — domestic insurer, express and implied authority — and both
let a student pattern-match without understanding.

## 3. Flashcards

Competitors offer them, and we have unusually good raw material for them
already: **642 questions, each with a written explanation**, plus 50 lessons
whose key facts are already bolded.

**Why this is cheap for us and expensive for them.** A flashcard is a prompt
and a response. Every question in `content/questions/` already carries both —
the stem and the explanation — and every card would inherit the same review
gate, so a card cannot say something a licensed producer has not signed off.
Nobody has to write a card deck from scratch.

**Three shapes worth considering, in order of value:**

- **Term cards.** Front: *morale hazard*. Back: the definition, from the
  lesson that teaches it. These are what most people mean by flashcards, and
  Modules 1 and 2 are dense with terms that only need recognising.
- **Figure cards.** Front: *Texas minimum auto liability limits*. Back:
  **30/60/25**. The Texas module is full of numbers — 24 CE hours, 3 ethics,
  $300,000 guaranty cap, 10/60 notice, 15/15/5 prompt payment — and numbers
  are exactly what spaced repetition is good at.
- **Question cards.** A question re-used as a card. Cheapest to build and the
  least valuable: a four-option question tests recognition, and turning it
  into a card mostly tests whether they remember the answer letter.

**Build the cram sheets first** — same recall benefit for the figures, a
fraction of the machinery, and the selection work transfers directly into
cards later.

**Recommendation: term and figure cards, authored as their own Markdown files
under `content/cards/`,** with the same front matter and review gate as
questions. They are not a by-product of the question bank; they teach a
different thing. Reusing question text would produce cards that feel like
leftovers.

**What it needs technically:** a `cards` table with the same three-way split
discipline if a card's back is ever scored, a `card_reviews` table for
spaced-repetition state per student, and a scheduler (SM-2 or a simpler
Leitner box). The review UI is simple; the scheduling is where the thought
goes.

**One caution.** Flashcards reward recall of isolated facts. The exam asks
scenario questions — *"an insured does X, is it covered?"* — which cards
cannot rehearse. Cards should be sold and framed as a supplement to the
question bank, never as a substitute, or students will over-practise the
easy half of the exam.

---

## 4. Mock-only questions

`questions.mock_only` exists and is false everywhere. Roughly 200 questions
written for mocks alone would make a student's first mock a real measurement
instead of a recall test — see the migration header on
`20260301000700_module_attempts.sql` for why that matters to readiness.

## 5. The remaining TAC rules

Five Texas Administrative Code rules the blueprint cites, all sitting beneath
statutes already taught. See `docs/blueprint-coverage.md`. Lowest value of
anything on this list.

## 6. Personal Lines course

`docs/competitor-research.md` records the roadmap: finish P&C, then Personal
Lines (308 candidates a month, and its blueprint is largely our Modules 1 and
2, so roughly 15% more work), then decide on Life & Health once the first
course has sold something.
