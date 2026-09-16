# Reviewing a module

Review runs **module by module**, so a finished module can reach students
while the rest waits. Nothing in `content/` or `content/questions/` is visible
to a student until its own file carries a sign-off.

## Why this gate is strict

**A lesson that is wrong misleads a student. A wrong answer key marks a
correct answer wrong.** The second is worse: the student will believe the
material over themselves and un-learn something they had right. That is the
reason the gate is an allowlist — publishing requires an affirmative line
naming who signed off and when, and anything else is held as a draft and
reported.

These all used to publish, and now none of them do:

```
review: not yet reviewed
review: unreviewed
review: UNREVIEWD — typo
review: pending review by a producer
```

## The commands

```bash
node scripts/review-module.mjs --status                              # where everything stands
node scripts/review-module.mjs --module 01 --reviewer "Your Name"    # sign off lessons + questions
node scripts/review-module.mjs --module 01 --reviewer "Your Name" --questions-only
node scripts/review-module.mjs --module 01 --undo                    # take it back
node scripts/import-questions.mjs                                    # regenerate the seed
```

The script will not read your name from git config. Signing a module off says
a qualified person read every question in it and stands behind the answer key,
so it is typed on purpose.

## What to check, per question

Work through a file top to bottom. For each question:

1. **Is the keyed answer right?** This is the whole job. Everything else on
   this list is secondary to it. Where the answer turns on a Texas statute,
   check the citation in the explanation against the statute text in
   `reference/statutes/`.
2. **Is exactly one option defensible?** The importer enforces one `[x]`, but
   it cannot tell you whether a second option is *also* arguably correct. Two
   defensible options is a broken question even when the key is right.
3. **Is the explanation true, and does it teach?** It should say *why* the
   answer is what it is, not restate the verdict.
4. **Are the distractors wrong for a reason?** The best wrong answer is the
   one a specific common mistake produces. A distractor nobody would pick
   narrows a four-option question to three.
5. **Do the options give the answer away?** Differences in length, grammar or
   specificity are tells. A student who learns to read the tells has learned
   nothing about insurance.
6. **Does it test the concept rather than the wording?** A question answerable
   by spotting which option repeats a phrase from the lesson measures reading.
7. **Is it one idea?** A question needing two unrelated facts cannot tell you
   which one the student was missing.

## Two things to be suspicious of

**Numbers.** Every figure is a place an error hides — limits, deductibles,
notice periods, penalty caps, percentages. Check the arithmetic in any
question that computes a payment, and check statutory figures against the
source rather than against memory.

**Questions that decline to answer.** Some questions deliberately answer
"this course does not teach that — get it from the statute", because the
chapter has not been obtained. Continuing education hours (Ch. 4004) and the
Texas minimum liability limits (Transportation Code Ch. 601) are the two.
**Do not "fix" these by supplying a number** unless you have the statute in
front of you. See `docs/module-5-source-gaps.md`.

## After signing off

Run `node scripts/import-questions.mjs` (and `import-content.mjs` if you
signed lessons off too), commit, and push. The status command will show the
reviewer and date it recorded.

If you later find a mistake in a module you signed off, `--undo` takes the
whole module back to draft immediately. That is cheaper than leaving a wrong
answer key live while you fix one file.
