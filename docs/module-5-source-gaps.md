# Module 5 — what is still needed, and what it blocks

**The blueprint itself is now in the repository**, at
`reference/blueprint/pc-agent-state-specific.txt` — Pearson VUE #124401, the
P&C agent state-specific outline, effective 1 September 2026. Every Texas
citation should trace to a line there. It replaces the hand-transcription this
file used to depend on, which had already been caught mislabelling two
chapters.

**35 of the 40 cited chapters are in hand.** Tiers 1 and 2 are complete, and
the six Tier 3 chapters that filled an empty blueprint line are in too.

## What the blueprint settled

- **TX.I.B.4 "Stock, mutual"** cites **547.001 and 801.001**. Both held.
  §801.001(2) is the real source — it defines "insurer" to include a mutual
  company of any kind, a Lloyd's plan, a reciprocal and more. Taught in
  Company Types and Certificates of Authority.
- **TX.I.C.2 "Exemptions/exceptions"** cites **4002.003**, exemptions from the
  examination requirement. Held and taught.
- **TX.I.D.1.f cites "TIC 541.056" for rebating, and that section does not
  exist.** The error is in the published outline. The trade practices lesson
  says so and points to 1806.104/.053/.153 instead.

## Two citations in the outline that do not land

**This is now a pattern, not a one-off. Verify a blueprint citation before
acting on it.**

1. **TX.I.D.1.f — "TIC 541.056" for rebating.** No such section; Chapter 541
   runs .051 to .055 then jumps to .059. Rebating is at 1806.104/.053/.153.
2. **TX.II.A — "TAC § 5.5002" for "Property and casualty definitions."**
   Checked on texreg.sos.state.tx.us: 28 TAC §5.5002 is **Title 28, Part 1,
   Chapter 5, Subchapter F, Division 1, "Inland Marine Insurance — Imports"**,
   effective 07 May 2025. It is not a definitions rule. **Where the Texas
   property and casualty definitions actually live is unknown.**

Neither error was found by reasoning about the outline — both were found by
opening the source it pointed at.

## What is still not taught

Five lines, and every one of them is a **Texas Administrative Code** rule
rather than a statute. The TAC lives on a different site
(<https://texreg.sos.state.tx.us>), is HTML rather than PDF, and
`scripts/extract-statute.py` cannot read it — so these must be pasted in as
text.

| Blueprint line | Rule | What it covers |
| --- | --- | --- |
| **TX.II.A** | ~~28 TAC §5.5002~~ **unknown** | Property and casualty definitions — **its own blueprint line**, and the cited rule is Inland Marine Imports. See above. |
| TX.I.D.2 | 28 TAC §5.9340–.9357 | Rating and underwriting practices |
| TX.I.D.1.a | 28 TAC §21.201–.205 | Claims practices, beneath Chapter 542 |
| TX.I.D.1.b–c | 28 TAC §21.4, §21.111, §21.115 | False advertising, misrepresentation |
| TX.I.C.1.a, 8.b | 28 TAC §1.502 | Felony convictions and notification |

**TX.II.A has no usable citation**, so it cannot be chased until the right rule
is identified. Of the rest, §21.201–.205 is the most useful: claims practices,
the rule layer beneath a chapter already taught.

**TX.II.C, "Approval of Rates and Forms"**, cites "TIC 5.35", which is not a
recognisable Insurance Code section. It is most likely a TAC reference. Treat
it as unresolved.

## The Tier 3 chapters deliberately not downloaded

201, 401, 404, 481, 491, 521 and GV 2001 map to TX.I.A.1–A.3. Lesson 01
already teaches that ground from Chapters 30–40, 36, 38, 39 and §541.101.
They would deepen material that exists rather than fill a hole.

Run `node scripts/statutes-status.mjs` to see them, and
`node scripts/check-citations.mjs --headings` to audit what the lessons cite.
