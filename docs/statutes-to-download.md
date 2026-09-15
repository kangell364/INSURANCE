# Statutes still to download

Every chapter the exam blueprint cites that is **not** in
`reference/statutes/`. Ordered by what each one unblocks.

## How to download one

Open the link, then use the site's **Download PDF** option. Save it as
`IN.4004.pdf`, `TN.601.pdf` and so on — the code prefix matters, because
Insurance Code 401 and Labor Code 401 are different chapters and the exam
cites both.

Then, in the repo:

```
python3 scripts/extract-statute.py path/to/IN.4004.pdf > reference/statutes/IN.4004.txt
```

**The link format** is the site's own, taken from the internal cross-reference
links inside the PDFs already downloaded — not guessed. The two-letter code
comes from the same place:

| Code | Which code |
| ---- | ---------- |
| `IN` | Insurance Code |
| `TN` | Transportation Code |
| `LA` | Labor Code |
| `GV` | Government Code |
| `FI` | Finance Code |
| `BC` | Business & Commerce Code |

These links have not been fetched from this environment — the network policy
blocks the site — so if one 404s, the fallback is
<https://statutes.capitol.texas.gov> → pick the code → find the chapter.


## Tier 1 — each blocks a whole lesson

Seven files, five topics. Between them these account for an estimated 8–10 of the 30 Texas questions, and none of the material can be written without them. **If you only do one batch, do this one.**

| ✓ | Chapter | Subject | What it unblocks |
| - | ------- | ------- | ---------------- |
| ☐ | [IN 4004](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=4004) | Continuing Education | Whole lesson. CE hours, cycle, carry-over, exemptions. TX.I.C.4. |
| ☐ | [IN 462](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=462) | Property & Casualty Insurance Guaranty Association | Whole lesson. Covered-claim limits, assessments, exclusions. TX.II.G, its own blueprint line. |
| ☐ | [TN 601](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=TN&Value=601) | Financial Responsibility (Transportation Code) | The minimum liability limits. TIC 1952.101 and 1952.105 both defer to it, so the course cannot state them without it. TX.II.E.2. |
| ☐ | [LA 401](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=LA&Value=401) | Workers’ Compensation — Definitions (Labor Code) | TX.II.F.1. |
| ☐ | [LA 406](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=LA&Value=406) | Workers’ Compensation — Coverage & Employer Election (Labor Code) | The non-subscriber rule, which is the most distinctively Texan thing in the module. TX.II.F.1. |
| ☐ | [LA 408](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=LA&Value=408) | Workers’ Compensation — Benefits (Labor Code) | Income, medical, death and burial benefits. TX.II.F.2. |
| ☐ | [IN 2151](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=2151) | Texas Automobile Insurance Plan Association | Whole lesson. The auto residual market. TX.II.E.4. |

## Tier 2 — each blocks a section of a lesson that otherwise exists

The four company-type chapters (801, 982, 547, 941) are one lesson between them, so they are best fetched together.

| ✓ | Chapter | Subject | What it unblocks |
| - | ------- | ------- | ---------------- |
| ☐ | [IN 801](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=801) | Certificates of Authority | Admitted vs non-admitted. TX.I.B.1 and B.5. |
| ☐ | [IN 982](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=982) | Foreign, Domestic and Alien Insurers | TX.I.B.3. |
| ☐ | [IN 547](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=547) | Stock and Mutual Companies | TX.I.B.4. |
| ☐ | [IN 941](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=941) | Texas Lloyds | TX.I.B.6. |
| ☐ | [IN 542A](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=542A) | Claims Arising from Forces of Nature | §542.060(c) sets a different interest rate "in an action to which Chapter 542A applies", so the familiar 18% is qualified and the course cannot say how without this. |
| ☐ | [IN 4056](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=4056) | Non-resident Agents | TX.I.C.1.b. |
| ☐ | [IN 4002](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=4002) | Licensing Exemptions and Exceptions | TX.I.C.2. |
| ☐ | [IN 4101](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=4101) | Adjusters | TX.I.C.1.g. |
| ☐ | [IN 701](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=701) | Insurance Fraud | TX.I.D.1.h. |
| ☐ | [IN 544](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=544) | Prohibited Discrimination | TX.I.D.1.g. Not taught at all at present. |

## Tier 3 — smaller, or peripheral

Worth having for completeness. Several are already covered indirectly by chapters 31, 36, 38 and 39.

| ✓ | Chapter | Subject | What it unblocks |
| - | ------- | ------- | ---------------- |
| ☐ | [IN 862](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=862) | Fire Insurance Policies | Liquidated demand. TX.II.D.5. |
| ☐ | [IN 1954](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=1954) | Transportation Network Companies | Rideshare. TX.II.E.5. |
| ☐ | [IN 2203](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=2203) | Texas Medical Liability Underwriting Association (JUA) | TX.II.H. |
| ☐ | [IN 4153](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=4153) | Risk Managers | TX.I.C.1.h. |
| ☐ | [IN 521](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=521) | Department Complaint Handling | TX.I.A.2 and A.3. |
| ☐ | [IN 401](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=401) | Examination of Insurers | TX.I.A.2. NB: Insurance Code 401, not Labor Code 401. |
| ☐ | [IN 201](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=201) | Department Funds | TX.I.A.1. |
| ☐ | [IN 404](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=404) | Hazardous Condition of Insurers | TX.I.A.1, and referenced by §83.051. |
| ☐ | [IN 481](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=481) | Publication of Reports | TX.I.A.1. |
| ☐ | [IN 491](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=IN&Value=491) | Holding Company Systems | TX.I.A.1. |
| ☐ | [GV 2001](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=GV&Value=2001) | Administrative Procedure Act (Government Code) | Notice of hearing, cited at TX.I.A.3 as Govt 2001.051. |
| ☐ | [FI 304](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=FI&Value=304) | Interest Rates (Finance Code) | §304.003 is the rate §542.060(c) builds on. Only needed alongside IN 542A. |
| ☐ | [BC 17](https://statutes.capitol.texas.gov/GetStatute.aspx?Code=BC&Value=17) | Deceptive Trade Practices (Business & Commerce Code) | §17.46 is cross-referenced throughout Chapter 541, including the private action at §541.151. |

## The Texas Administrative Code, Title 28

A **different site**: <https://texreg.sos.state.tx.us/public/readtac$ext.viewtac>
→ Title 28, Insurance. These are rules, not statutes, and the blueprint cites
them directly.

| ✓ | Rule | Subject |
| - | ---- | ------- |
| ☐ | **§5.5002** | Property and casualty definitions — **its own blueprint line**, TX.II.A |
| ☐ | **§21.201–.205** | Claims practices — the rule layer beneath Chapter 542 |
| ☐ | **§1.502** | Felony convictions and notification |
| ☐ | **§5.204** | Auto coverage |
| ☐ | **§5.7002** | Auto renewal, non-renewal and cancellation |
| ☐ | **§5.9340–.9357** | Rating and underwriting practices |
| ☐ | **§15.2–15.6** | Surplus lines |
| ☐ | **§19.801–.805, §19.1001–.1030** | Licensing and continuing education |
| ☐ | **§19.1201–.1206** | Managing general agents |
| ☐ | **§19.1301–.1320** | Risk managers |
| ☐ | **§21.4, §21.111, §21.115** | Misrepresentation and advertising |
| ☐ | **§29.1** | Guaranty association |

**§5.5002 and §21.201–.205 first** — the first has its own blueprint line, the
second sits under a chapter already taught.

The TAC is HTML rather than PDF, so `scripts/extract-statute.py` will not read
it. Paste the text into chat instead, as you did with Chapter 2210.

## Already held

`reference/statutes/` holds 30 chapters of the Insurance Code: 30–40, 81–86,
101, 102, 541, 542, 551, 981, 1806, 1952, 2211, 4001, 4003, 4005, 4051, plus
2210 as a condensed key-provisions file. Eighteen of those are cited by the
Texas sections; the rest support the general-knowledge modules.

