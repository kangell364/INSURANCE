# Module 5 — what is still needed, and what it blocks

Derived from the TX.I and TX.II citations in Pearson VUE #124401, checked
against `reference/statutes/`. **35 of the 40 chapters the Texas sections cite
are in hand.** This file lists the other 5, what each one blocks, and in what
order they are worth getting.

> **Tier 1 is done.** IN 4004, IN 462, TN 601, LA 401, LA 406, LA 408 and
> IN 2151 arrived on 16 September 2026 and are extracted. They produced four
> new lessons -- Continuing Education, the Guaranty Association, Texas
> Workers' Compensation, and Financial Responsibility and TAIPA -- and closed
> the two gaps where existing lessons had to say "this course does not state
> that figure": the CE hours in the renewal lesson and the **30/60/25**
> minimum liability limits in the UM lesson.
>
> **Tier 2 is done too** (16 September 2026). It produced three more lessons
> -- Prohibited Discrimination, Company Types and Certificates of Authority,
> and Adjusters, Non-residents, Examination and Fraud -- and closed the last
> caveat on a figure already taught: **Chapter 542A** now says which claims
> carry the alternative prompt-pay interest rate rather than the 18%.
>
> **Two subjects in the download list were wrong**, which only downloading
> revealed. IN 547 is *False Advertising by Unauthorized Insurers*, not stock
> and mutual companies; IN 4002 is *Examination of License Applicants*, not
> licensing exemptions. So **TX.I.B.4 and TX.I.C.2 remain unsourced**, and the
> right chapters are unknown -- the blueprint PDF is not in this repository,
> so it cannot be told whether the transcription or the blueprint was at
> fault. That is now the largest known gap in Module 5.
>
> Run `node scripts/statutes-status.mjs` for the rest, which is Tier 3.

**Where.** <https://statutes.capitol.texas.gov> → pick the code → the chapter.
Free, and the site's own PDF is what `scripts/extract-statute.py` expects.

> I earlier described Module 5 as "fully unblocked" because 30 chapters were
> in hand. That was wrong: 30 chapters were in hand, but not the 30 the
> blueprint cites. Roughly two thirds of the module can be written from
> source; the rest is listed here rather than written from memory, because
> `content/README.md` forbids exactly that.

---

## The list, with links

**`docs/statutes-to-download.md`** is the working list: every missing chapter
as a direct link to the Texas statutes site, in three tiers by what each one
blocks, with a checkbox column. It also covers the Title 28 rules, which live
on a different site.

Tier 1 is seven files covering five topics — continuing education (IN 4004),
the Guaranty Association (IN 462), financial responsibility and the minimum
liability limits (TN 601), workers' compensation (LA 401, 406, 408) and TAIPA
(IN 2151). Those account for an estimated 8–10 of the 30 Texas questions.

---

## What can be written without any of the above

Ten lessons, covering an estimated 20 of the 30 questions:

1. The Commissioner and the Department — TIC 31, 36, 38, 39, 40
2. Enforcement and penalties — TIC 82, 83, 84, 85, 86, 541.101–.111
3. Licensing: types and appointment — TIC 4001, 4051
4. Licence application, renewal and revocation — TIC 4003, 4005
5. Unfair and prohibited trade practices — TIC 541, 1806
6. Claims practices and prompt payment — TIC 542
7. Surplus lines — TIC 981
8. Declination, cancellation and non-renewal — TIC 551
9. Windstorm and the FAIR Plan — TIC 2210, 2211
10. Auto: uninsured motorists and PIP — TIC 1952
