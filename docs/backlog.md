# Backlog

Things worth building, not yet started. Ordered by what would move the
product most, not by effort.

---

## 1. Flashcards

Competitors offer them, and we have unusually good raw material for them
already: **612 questions, each with a written explanation**, plus 50 lessons
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

## 2. Mock-only questions

`questions.mock_only` exists and is false everywhere. Roughly 200 questions
written for mocks alone would make a student's first mock a real measurement
instead of a recall test — see the migration header on
`20260301000700_module_attempts.sql` for why that matters to readiness.

## 3. The remaining TAC rules

Five Texas Administrative Code rules the blueprint cites, all sitting beneath
statutes already taught. See `docs/blueprint-coverage.md`. Lowest value of
anything on this list.

## 4. Personal Lines course

`docs/competitor-research.md` records the roadmap: finish P&C, then Personal
Lines (308 candidates a month, and its blueprint is largely our Modules 1 and
2, so roughly 15% more work), then decide on Life & Health once the first
course has sold something.
