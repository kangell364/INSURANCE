# Blueprint coverage audit

Checked 16 September 2026 against `reference/blueprint/`, which holds both
halves of Pearson VUE #124401 as extracted from the PDF.

**The exam is 130 scored questions**: 100 general knowledge and 30 Texas.
The course is **50 lessons and 608 questions**.

| Blueprint section | Scored | Module |
| --- | --- | --- |
| I. Types of Policies | 22 | 3 — Property Coverages |
| II. Insurance Terms and Related Concepts | 15 | 1 — Insurance Fundamentals |
| III. Policy Provisions and Contract Law | 13 | 2 — Policy Structure and Contract Law |
| IV. Types of Policies, Bonds, and Related Terms | 23 | 4 — Casualty Coverages |
| V. Insurance Terms (casualty) | 15 | 1 and 4 |
| VI. Policy Provisions (casualty) | 12 | 2 and 4 |
| TX.I. Texas Statutes Common to P&C | 18 | 5 — Texas Statutes and Rules |
| TX.II. Texas Statutes Pertinent to P&C | 12 | 5 |

**Every section has a module. Every sub-line sampled has lesson coverage.**

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

**Five Texas Administrative Code rules.** All sit beneath statutes the course
already teaches from the statutory side, and the TAC is on a separate site in
HTML that `scripts/extract-statute.py` cannot read.

| Line | Rule | Status |
| --- | --- | --- |
| TX.I.D.1.b | 28 TAC §21.115 | **Taught** — P&C advertising |
| TX.I.D.1.b | 28 TAC §21.111 | Not fetched — comparisons |
| TX.I.D.1.a | 28 TAC §21.201–.205 | Not fetched — claims practices |
| TX.I.D.1.c | 28 TAC §21.4 | Not fetched — misrepresentation |
| TX.I.D.2 | 28 TAC §5.9340–.9357 | Not fetched — rating and underwriting |
| TX.I.C.1.a, C.8.b | 28 TAC §1.502 | Not fetched — felony notification |
| **TX.II.A** | ~~28 TAC §5.5002~~ | **The blueprint's citation is wrong.** That rule is "Inland Marine Insurance — Imports". Where the P&C definitions live is unknown. |

**TX.II.C "Approval of Rates and Forms" cites "TIC 5.35"**, which is not a
valid Insurance Code section. Unresolved.

## Two errors in the published outline

Both found by opening the source, not by reasoning about it.

1. **TX.I.D.1.f cites TIC §541.056** for rebating. No such section — Chapter
   541 runs .051 to .055 then jumps to .059. Rebating is at §1806.104, §1806.053
   and §1806.153.
2. **TX.II.A cites 28 TAC §5.5002** for property and casualty definitions. That
   rule is about inland marine imports.

**Verify a blueprint citation before acting on it.**
