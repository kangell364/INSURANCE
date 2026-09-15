# Texas General Lines — Property & Casualty: verified exam facts

Everything on this page is transcribed from a primary source and names it.
Nothing here is recalled, inferred, or taken from a third-party summary.

**Sources**

- **#124401** — *TEXAS Insurance Supplement, Examination Content Outlines*,
  Pearson VUE, effective 1 September 2026. The blueprint.
- **#124400** — *Texas Candidate Handbook*, Pearson VUE. Logistics, scoring,
  licensing.
- **Examination Pass Rates, 08/01/2026 – 08/31/2026**, Pearson VUE for the
  Texas Department of Insurance. Volumes and pass rates.

Both were supplied as PDFs; `pearsonvue.com` and `tdi.texas.gov` are
unreachable from the build environment, so they cannot be re-fetched
automatically. Re-check both when a new edition is published.

---

## The examination

| Fact | Value | Source |
| ---- | ----- | ------ |
| Exam code | `InsTC-PC06` (English) | #124400 |
| Time allotted | **150 minutes** | #124400 |
| Examination fee | **$49** | #124400 |
| Licence application fee | **$50** per licence type | #124400 |
| Scored questions | **130** | #124401 |
| Total questions | **145** (130 scored + 15 pretest) | #124401 |
| Format | Multiple choice, two parts (general + state) | #124400 |

A Spanish-language form exists at the same duration and fee.

## Blueprint

| Section | Scored questions |
| ------- | ---------------- |
| GK.I Types of Policies | 22 |
| GK.II Insurance Terms and Related Concepts | 15 |
| GK.III Policy Provisions and Contract Law | 13 |
| GK.IV Types of Policies, Bonds, and Related Terms | 23 |
| GK.V Insurance Terms and Related Concepts (Casualty) | 15 |
| GK.VI Policy Provisions (Casualty) | 12 |
| **General knowledge subtotal** | **100** (+10 pretest) |
| TX.I Texas Statutes and Rules Common to P&C | 18 |
| TX.II Texas Statutes and Rules Pertinent to P&C | 12 |
| **State-specific subtotal** | **30** (+5 pretest) |
| **Total scored** | **130** |

Seeded in `supabase/seed.sql` and stored as `topics.question_count`.

---

## Scoring — read this before building anything that predicts a pass

**Texas does not publish a pass percentage.** #124400:

> The passing score of an examination was set by the Texas Department of
> Insurance (in conjunction with Pearson VUE) after a comprehensive study was
> completed for each examination. Raw scores are converted into scaled
> scores…

Three consequences:

1. **The reported score is scaled, not a raw percentage.** Raw scores are
   converted onto a common reporting scale.
2. **Forms are equated.** Different versions of the exam differ slightly in
   difficulty, and a statistical correction is applied so that the same scaled
   score means the same level of knowledge on any form.
3. **The cut score is not disclosed** in either publication.

The widely-repeated "70% to pass" therefore has no basis in either primary
source. It may be approximately right; it is not verifiable from these
documents, and it is not the same *kind* of number as a practice-test
percentage.

**What this means for the product.** `READY_THRESHOLD` in `lib/readiness.ts`
is 80% *on our own material*. It is not calibrated to the state's cut score,
because that number is not public. Any copy implying "you would pass the state
exam" is a claim we cannot support. Copy that says "you are consistently
scoring well above our bar" is one we can.

The handbook also confirms the score is computed over **the exam as a whole**,
not each part separately — so a candidate cannot fail on the state section
alone while passing overall. Worth knowing before any per-section "you are
failing this part" messaging is built.

---

## Licensing (from #124400)

- Apply at `www.sircon.com/texas` **after** passing.
- The application must be completed **within one year** of passing, or the
  examination must be retaken.
- Applicants must be at least 18, submit a completed application with fee and
  fingerprint receipt.
- Temporary licences: available to General Lines applicants, **180 days**, not
  renewable.
- A **$10** fee applies to each additional company appointment.

## Test centre rules (from #124400)

- Arrive **30 minutes** before the examination.
- No personal items in the testing room — phones, watches, wallets, bags,
  hats, weapons.
- Calculators only if silent, hand-held, non-printing and without an
  alphabetic keypad. Financial calculators are **not** permitted, and none are
  provided.

These are the bones of an "exam day" page, which is a genuine search-traffic
opportunity. Write it from this file rather than from memory.

---

## Volumes and pass rates (August 2026)

General Lines — Property & Casualty (English), exam code `InsTX-PC06`:

| Attempt type | Graded | Passed | Pass rate | Failed | Fail rate |
| ------------ | ------ | ------ | --------- | ------ | --------- |
| First-time takers | 1,057 | 646 | 61% | 411 | 39% |
| Repeaters | 765 | 290 | 38% | 475 | 62% |
| **All sittings** | **1,822** | **936** | **51%** | **886** | **49%** |

Read that second row twice. **Candidates who have already failed once pass at
38%** — they do markedly *worse* on a retake than a first-timer does on their
first attempt, and there are 765 of them in a single month.

That is the clearest commercial signal in any of these documents, and the
market analysis in `docs/competitor-research.md` is built on it.

The Spanish-language form (`InsTX-PC26`) had 21 first-time sittings in the
same month — under 2% of the English volume.
