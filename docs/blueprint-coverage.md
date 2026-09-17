# Blueprint coverage audit

Checked 16 September 2026 against `reference/blueprint/`, which holds both
halves of Pearson VUE #124401 as extracted from the PDF. **Counts refreshed
17 September 2026**; the coverage findings below were not re-audited on that
date and still carry their original date.

**The exam is 130 scored questions**: 100 general knowledge and 30 Texas.
The course is **50 lessons and 699 questions**, up from 608 at the original
audit. Every one of those 91 additions came from a topic list the owner
supplied, not from an audit of my own.

**Nothing is published.** All 50 lessons are held as drafts; no module has
been signed off. Coverage is what a student *could* be taught, not what a
student can see.

| Blueprint section | Scored | Module | Questions |
| --- | --- | --- | --- |
| I. Types of Policies | 22 | 3 — Property Coverages | 82 |
| II. Insurance Terms and Related Concepts | 15 | 1 — Insurance Fundamentals | 114 |
| III. Policy Provisions and Contract Law | 13 | 2 — Policy Structure and Contract Law | 124 |
| IV. Types of Policies, Bonds, and Related Terms | 23 | 4 — Casualty Coverages | 118 |
| V. Insurance Terms (casualty) | 15 | 1 and 4 | — |
| VI. Policy Provisions (casualty) | 12 | 2 and 4 | — |
| TX.I. Texas Statutes Common to P&C | 18 | 5 — Texas Statutes and Rules | 261 |
| TX.II. Texas Statutes Pertinent to P&C | 12 | 5 | — |

**Every section has a module. Every sub-line sampled has lesson coverage.**

## The bank is not shaped like the exam

Sections V and VI split across modules, so only two mappings are exact. Those
two are the ones worth looking at.

| | Share of the exam | Share of the bank |
| --- | --- | --- |
| Module 3 — Property Coverages (section I) | 16.9% | **11.7%** |
| Modules 1, 2 and 4 (sections II–VI) | 60.0% | 50.9% |
| Module 5 — Texas (TX.I, TX.II) | 23.1% | **37.3%** |

**Section I is the largest single general-knowledge section on the exam — 22
scored questions — and it has the thinnest bank in the course.** Module 5 has
more than half again its share.

Module 5 being heavy is defensible: statutes are specific, numerous, and
carry figures a candidate has to recall exactly, so more questions per scored
point is the right shape. Module 3 being light is not defensible on the same
grounds, and it is the clearest gap the numbers show. **44 questions would
bring Module 3 to the exam's own weighting** -- (0.169 x 699 - 82) / (1 -
0.169). An earlier draft of this file said ~90, which was wrong.

It is a gap in depth, not in coverage. All 26 policy types Section I names --
HO-2 through HO-8, DP-1 through DP-3, CPP, commercial property and its five
sub-forms, BOP, builders risk, cyber first-party, both floaters, NFIP,
earthquake, mobile homes, watercraft, farmowners and windstorm -- are taught,
and all 26 have at least one question. Three looked absent on a first pass and
none were: the course writes "farmowners" as one word, and abbreviates the
other two to BOP and NFIP.

**BOP is listed twice in the outline**, at I.C.3 and again at IV.H. Its lesson
and its 12 questions sit in Module 4, which matches IV.H. Any count that
splits questions by module will therefore under-state Section I slightly, and
there is no placement that avoids this.

This is a statement about counts, not about quality. A thin bank on a
well-taught topic is a different problem from a gap in the teaching, and only
the first of those is visible here.

## What the audit actually found

Three topics had lesson coverage but **no question**, now fixed: personal auto
**transportation expenses**, business auto **loss of use and rental
reimbursement**, and **general versus special damages**.

One line looked absent and was not. **III.S "Policy Application"** never appears
as that phrase, but the application is taught in five places — as the **offer**
in Elements of a Contract, as the source of **representations** in
Representations, Warranties and Concealment, as **underwriting information** in
the FCRA lesson, and as what the **declarations restate**. Searching for a
blueprint's exact wording is not the same as checking coverage.

## What is genuinely not taught

**Texas Administrative Code rules.** The TAC is on a separate site in HTML
that `scripts/extract-statute.py` cannot read, so rules are fetched by hand.

Since the original audit the lessons have come to cite **seven** TAC rules.
**One has been fetched.** The other six are taught from the statute they sit
beneath rather than from the rule's own text, which is sound as far as it goes
and is not the same as having read the rule.

| Rule | Subject | Source text held |
| --- | --- | --- |
| 28 TAC §21.115 | P&C advertising | **Yes** — `reference/tac/` |
| 28 TAC §21.101 | Unfair competition, general | No |
| 28 TAC §21.111 | Comparisons | No |
| 28 TAC §21.113 | Misleading statements | No |
| 28 TAC §21.114 | Advertising of benefits | No |
| 28 TAC §19.1201 | Adjuster licensing | No |
| 28 TAC §5.204 | Automobile insurance | No |

Still cited by the blueprint and neither fetched nor taught: 28 TAC
§21.201–.205 (claims practices), §21.4 (misrepresentation), §5.9340–.9357
(rating and underwriting), §1.502 (felony notification).

**TX.II.A** — ~~28 TAC §5.5002~~. **The blueprint's citation is wrong.** That
rule is "Inland Marine Insurance — Imports". Where the P&C definitions live is
unknown.

**TX.II.C "Approval of Rates and Forms" cites "TIC 5.35"**, which is not a
valid Insurance Code section.

## What checks this, and what it cannot see

Three checks run in CI against the content:

- `check-citations.mjs` — every `§N.N` resolves to a real section.
- `check-citation-claims.mjs` — the numbers and subjects in a sentence appear
  in the sections that sentence cites. This is what catches a citation to the
  wrong *real* section, which is how the course once had the 30/60/25 floor
  reaching PIP.
- `check-question-coverage.mjs` — a term a lesson defines is the correct
  answer somewhere.

**None of them reads a TAC rule.** TAC citations are skipped by both citation
checks, because 28 TAC §21.115 and Insurance Code Chapter 21 are unrelated and
resolving one against the other would be worse than not checking. So the six
unfetched rules above are unverified by anything except a human reading them.

**None of them checks whether a lesson is *right*.** They check that it is
consistent with a source that is present. A lesson can state a rule correctly
in words no statute uses, and can state it wrongly in words that match. The
review gate is what stands between either and a student.

## Where the two unresolved lines probably live

28 TAC Chapter 5 is "Property and Casualty Insurance". Its subchapter list,
read from the Secretary of State portal on 16 September 2026, makes two
previously unresolved blueprint lines tractable:

- **TX.II.A, property and casualty definitions** — **Subchapter Q, "General
  Property and Casualty Rules"** is the likely home. The blueprint's §5.5002
  points into **Subchapter F**, which is "Inland Marine Insurance, Multi-Peril
  Insurance, and Commercial Lines" — which is why it returned an inland marine
  rule.
- **TX.II.C, approval of rates and forms** — **Subchapter M, "Filing
  Requirements"** and **Subchapter X, "Prior Approval of Rates Under Certain
  Circumstances"**.

Neither is confirmed; both need the subchapter's rule list read before
fetching anything.

The same listing shows where the blueprint's other Chapter 5 citations sit:
**§5.204** in Subchapter A (Automobile Insurance), **§5.7002** in Subchapter H
(Cancellation, Denial, and Nonrenewal), and the **§5.9340–.9357** rating and
underwriting run near Subchapter U (Use of Credit Information or Credit
Scores) and Subchapter V (Territory Rating Requirements).

## Two errors in the published outline

Both found by opening the source, not by reasoning about it.

1. **TX.I.D.1.f cites TIC §541.056** for rebating. No such section — Chapter
   541 runs .051 to .055 then jumps to .059. Rebating is at §1806.104, §1806.053
   and §1806.153.
2. **TX.II.A cites 28 TAC §5.5002** for property and casualty definitions. That
   rule is about inland marine imports.

**Verify a blueprint citation before acting on it.**
