#!/usr/bin/env node
/**
 * Which cited statutes are in hand, and which are still missing.
 *
 * The exam blueprint cites 40 chapters. Writing a Texas lesson from anything
 * other than the chapter text is forbidden by content/README.md, so a missing
 * chapter is a hard block on a lesson, not an inconvenience. This prints the
 * state so nobody has to trust a hand-maintained checklist that can go stale.
 *
 *   node scripts/statutes-status.mjs
 *   node scripts/statutes-status.mjs --tier 1     # just the next batch
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const DIR = join(ROOT, 'reference', 'statutes')
const URL_FOR = (code, value) =>
  `https://statutes.capitol.texas.gov/GetStatute.aspx?Code=${code}&Value=${value}`

// tier 1 blocks a whole lesson each; tier 2 a section; tier 3 is completeness.
const REQUIRED = [
  ['IN', '4004', 1, 'Continuing Education', 'Whole lesson — CE hours, cycle, exemptions'],
  ['IN', '462', 1, 'P&C Guaranty Association', 'Whole lesson — its own blueprint line'],
  ['TN', '601', 1, 'Financial Responsibility', 'The minimum liability limits'],
  ['LA', '401', 1, "Workers' Comp — Definitions", 'TX.II.F.1'],
  ['LA', '406', 1, "Workers' Comp — Coverage & Election", 'The non-subscriber rule'],
  ['LA', '408', 1, "Workers' Comp — Benefits", 'Income, medical, death benefits'],
  ['IN', '2151', 1, 'TAIPA', 'Whole lesson — the auto residual market'],

  ['IN', '801', 2, 'Certificates of Authority', 'Admitted vs non-admitted'],
  ['IN', '982', 2, 'Foreign, Domestic and Alien Insurers', 'TX.I.B.3'],
  ['IN', '547', 2, 'Stock and Mutual Companies', 'TX.I.B.4'],
  ['IN', '941', 2, 'Texas Lloyds', 'TX.I.B.6'],
  ['IN', '542A', 2, 'Claims from Forces of Nature', 'Qualifies the 18% prompt-pay rate'],
  ['IN', '4056', 2, 'Non-resident Agents', 'TX.I.C.1.b'],
  ['IN', '4002', 2, 'Licensing Exemptions', 'TX.I.C.2'],
  ['IN', '4101', 2, 'Adjusters', 'TX.I.C.1.g'],
  ['IN', '701', 2, 'Insurance Fraud', 'TX.I.D.1.h'],
  ['IN', '544', 2, 'Prohibited Discrimination', 'TX.I.D.1.g — not taught at all yet'],

  ['IN', '862', 3, 'Fire Insurance Policies', 'Liquidated demand'],
  ['IN', '1954', 3, 'Transportation Network Companies', 'Rideshare'],
  ['IN', '2203', 3, 'Medical Liability JUA', 'TX.II.H'],
  ['IN', '4153', 3, 'Risk Managers', 'TX.I.C.1.h'],
  ['IN', '521', 3, 'Department Complaint Handling', 'TX.I.A.2-3'],
  ['IN', '401', 3, 'Examination of Insurers', 'NB: Insurance Code 401, not Labor Code'],
  ['IN', '201', 3, 'Department Funds', 'TX.I.A.1'],
  ['IN', '404', 3, 'Hazardous Condition of Insurers', 'Referenced by §83.051'],
  ['IN', '481', 3, 'Publication of Reports', 'TX.I.A.1'],
  ['IN', '491', 3, 'Holding Company Systems', 'TX.I.A.1'],
  ['GV', '2001', 3, 'Administrative Procedure Act', 'Cited as Govt 2001.051'],
  ['FI', '304', 3, 'Interest Rates', 'Only needed alongside IN 542A'],
  ['BC', '17', 3, 'Deceptive Trade Practices', '§17.46, cross-referenced in Ch. 541'],
]

const wanted = process.argv.indexOf('--tier')
const tierFilter = wanted === -1 ? null : Number(process.argv[wanted + 1])

/** A chapter counts as held if any file starts with `<CODE>.<VALUE>`. */
const onDisk = existsSync(DIR) ? readdirSync(DIR) : []
const held = ([code, value]) =>
  onDisk.some((f) => f === `${code}.${value}.txt` || f.startsWith(`${code}.${value}-`))

let missing = REQUIRED.filter((r) => !held(r))
if (tierFilter) missing = missing.filter((r) => r[2] === tierFilter)

// REQUIRED lists the chapters that were NOT in reference/statutes/ when this
// was written, so it is a shopping list rather than the full set of citations.
// Counting "held" against it therefore means "how many have since arrived".
const arrived = REQUIRED.filter(held)
const files = onDisk.filter((f) => f.endsWith('.txt') || f.endsWith('.md')).length
console.log(`reference/statutes/ holds ${files} file(s).`)
console.log(
  `Of the ${REQUIRED.length} chapters still needed, ${arrived.length} have arrived and ` +
    `${REQUIRED.length - arrived.length} are outstanding.\n`,
)

for (const tier of [1, 2, 3]) {
  const rows = missing.filter((r) => r[2] === tier)
  if (rows.length === 0) continue
  console.log(`Tier ${tier} — ${rows.length} file(s)`)
  for (const [code, value, , subject, blocks] of rows) {
    console.log(`  ${`${code}.${value}`.padEnd(9)} ${subject}`)
    console.log(`    ${blocks}`)
    console.log(`    ${URL_FOR(code, value)}`)
    console.log(`    save as reference/statutes/${code}.${value}.pdf, then:`)
    console.log(
      `    python3 scripts/extract-statute.py <file>.pdf > reference/statutes/${code}.${value}.txt`,
    )
  }
  console.log()
}

if (missing.length === 0) console.log('Nothing missing in that selection.')
