# Texas Insurance Code — chapters cited by the exam blueprint

Plain text extracted from the PDFs published at
<https://statutes.capitol.texas.gov>, retrieved 15 September 2026. Texas
statutes are public records.

Text rather than PDF, because text diffs when the legislature amends a
section and a binary does not. `scripts/extract-statute.py` does the
conversion; re-run it when a chapter is updated.

## Held

| Chapter | Subject |
| ------- | ------- |
| 30 | General provisions |
| 31 | Organization of department |
| 32 | Administrative powers and duties |
| 33 | Standards of conduct |
| 34 | Immunity from liability |
| 35 | Electronic transactions |
| 36 | Department rules and procedures |
| 37 | Ratemaking and policy form proceedings |
| 38 | Data collection and reports |
| 39 | Public access |
| 40 | Duties of state office of administrative hearings and commissioner in certain proceedings; rate setting proceedings |
| 81 | General provisions regarding discipline and enforcement |
| 82 | Sanctions |
| 83 | Emergency cease and desist orders |
| 84 | Administrative penalties |
| 85 | General criminal enforcement |
| 86 | Revocation or modification of certificate of authority; authority to bring certain actions |
| 101 | Unauthorized insurance |
| 102 | Charitable gift annuities |
| 541 | Unfair methods of competition and unfair or deceptive acts or practices |
| 542 | Processing and settlement of claims |
| 551 | Practices relating to declination, cancellation, and nonrenewal of insurance policies |
| 981 | Surplus lines insurance |
| 1806 | Prohibited practices and rebates related to policies |
| 1952 | Policy provisions and forms for automobile insurance |
| 2211 | FAIR Plan |
| 4001 | Agent licensing in general |
| 4003 | License expiration and renewal |
| 4005 | Conduct, disciplinary actions, and sanctions |
| 4051 | Property and casualty agents |

Chapter **2210** (Texas Windstorm Insurance Association) was supplied as text
rather than as a site PDF, so there is no `IN.2210.txt`; its examinable
provisions are in `IN.2210-key-provisions.md`.

This is the whole of the licensing and conduct core, most of the
Texas-specific programmes, and the enforcement and regulator chapters —
enough to write the Texas statutes module from source. What is still
outstanding, and why none of it blocks drafting, is in
`docs/source-documents-wanted.md`.

## Reading notes

Two chapters are long enough, and shaped awkwardly enough, that the
examinable material has been pulled out into a companion file rather than
left to be re-read in full:

- `IN.2210-key-provisions.md` — TWIA. The chapter runs to roughly 140 pages,
  most of it financing machinery the blueprint does not reach.
- `IN.1806-key-provisions.md` — rebating. The chapter states the same rule
  three times, once each for automobile, casualty and fire, under three
  different section numbers.

## The blueprint cites a repealed section

Publication #124401, effective 1 September 2026, cites **TIC 541.056** for
*Rebating*. That section does not exist. Chapter 541 runs .051 through .055
and then jumps to .059; sections 541.056, 541.057 and 541.058 appear nowhere
in the source PDF. They were repealed, and the blueprint has not caught up.

The blueprint's second citation for the same sub-topic, **TIC 1806.104**, is
correct and current. Rebating is taught from Chapter 1806. See
`IN.1806-key-provisions.md`.

The general lesson stands: **check every citation against the text before
relying on it.** The blueprint is authoritative about what is EXAMINED; it is
not a reliable guide to where the law currently sits. This was found in the
first chapter checked, which is not encouraging about the rest.

## A note on the extractor

The site's PDF generator renders non-breaking spaces as a literal capital
"A". An early version of `extract-statute.py` stripped those by guessing from
surrounding context, and in doing so silently deleted the real word "A" at
the start of 35 subsections across 9 chapters — turning "A person may not
acquire..." into "person may not acquire...", in licensing prohibitions that
would have been quoted straight into lessons.

It is now removed by length instead. Across all 23 chapter PDFs, standalone
runs of A occur in exactly two lengths: 1 (1,060 times, nearly all real
English) and 2 (3,712 times, all filler). The only systematic single-A filler
is the one between "Sec." and the section number. If a chapter is ever added
whose text contains a genuine two-letter "AA", that assumption breaks and the
script needs revisiting.
