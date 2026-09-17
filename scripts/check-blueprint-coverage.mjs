#!/usr/bin/env node
/**
 * Every line of the examination content outline, against the course.
 *
 * WHY
 *
 * docs/blueprint-coverage.md said "every sub-line sampled has lesson
 * coverage". Sampled. The outline has ~200 leaf entries and nobody had walked
 * all of them, so "we build directly from the outline" was an intent rather
 * than a fact anybody could check.
 *
 * The outline is unusually specific -- it does not say "insurance terms", it
 * names the Law of Large Numbers, moral/morale/physical hazard, and salvage
 * value. That specificity is what makes this checkable at all.
 *
 * SEARCH PATTERNS, AND WHY THEY ARE GENEROUS
 *
 * Four times in one week a naive grep here reported taught material as
 * absent: "express authority" (written "**Express** --"), "breach of duty",
 * "basic form perils", and three of Section I's policy types at once, because
 * the course writes "farmowners" as one word and abbreviates BOP and NFIP.
 *
 * This file's own first run repeated the mistake three more times: it called
 * "who is an employee" untaught because the phrase straddles a line break,
 * "examination of records" untaught because the lesson heads that section
 * "Examination and investigation", and "change of address" untaught because
 * the lesson writes "a change of mailing address", which is what the statute
 * says. The patterns below are the corrected ones.
 *
 * Every one of those was reported to the owner as a gap before being checked.
 * So the patterns below are deliberately loose: a false positive here costs a
 * minute of reading, and a false negative sends somebody to write a lesson
 * that already exists.
 *
 *   node scripts/check-blueprint-coverage.mjs
 *   node scripts/check-blueprint-coverage.mjs --markdown  # the comparison table
 *   node scripts/check-blueprint-coverage.mjs --max 0     # ratchet
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const LESSONS = join(ROOT, 'content', 'texas-general-lines-property-casualty')
const QUESTIONS = join(ROOT, 'content', 'questions', 'texas-general-lines-property-casualty')

const MARKDOWN = process.argv.includes('--markdown')
const MAX = (() => {
  const i = process.argv.indexOf('--max')
  return i === -1 ? null : Number(process.argv[i + 1])
})()

/**
 * [section, line, label, pattern]
 *
 * `line` is the outline's own numbering, so a finding can be taken straight
 * back to the PDF. Where the outline repeats itself -- BOP is at I.C.3 and
 * again at IV.H, TRIA at III.T and VI.N -- both entries are listed, because
 * the exam can test either and dropping one would hide a real gap.
 */
const OUTLINE = [
  // I. TYPES OF POLICIES (22)
  ['I', 'A.1', 'HO-2', /HO-?2\b/i],
  ['I', 'A.2', 'HO-3', /HO-?3\b/i],
  ['I', 'A.3', 'HO-4', /HO-?4\b/i],
  ['I', 'A.4', 'HO-5', /HO-?5\b/i],
  ['I', 'A.5', 'HO-6', /HO-?6\b/i],
  ['I', 'A.6', 'HO-8', /HO-?8\b/i],
  ['I', 'B.1', 'DP-1', /DP-?1\b/i],
  ['I', 'B.2', 'DP-2', /DP-?2\b/i],
  ['I', 'B.3', 'DP-3', /DP-?3\b/i],
  ['I', 'C.1', 'Commercial Package Policy', /commercial package|\bCPP\b/i],
  ['I', 'C.2.a', 'Building and business personal property', /business personal property|\bBPP\b/i],
  ['I', 'C.2.b', 'Causes of loss forms', /causes? of loss/i],
  ['I', 'C.2.c', 'Business income', /business income/i],
  ['I', 'C.2.d', 'Extra expense', /extra expense/i],
  ['I', 'C.2.e', 'Equipment breakdown', /equipment breakdown|boiler and machinery/i],
  ['I', 'C.3', 'Business Owners Policy', /business ?owners? polic|\bBOP\b/i],
  ['I', 'C.4', 'Builders risk', /builders?.risk/i],
  ['I', 'C.5', 'Cyber first-party coverage', /cyber/i],
  ['I', 'D.1', 'Personal articles floater', /personal articles/i],
  ['I', 'D.2', 'Commercial property floater', /floater/i],
  ['I', 'E', 'National Flood Insurance Program', /\bNFIP\b|national flood/i],
  ['I', 'F.1', 'Earthquake', /earthquake/i],
  ['I', 'F.2', 'Mobile homes', /mobile home|manufactured home/i],
  ['I', 'F.3', 'Watercraft', /watercraft|\bboat\b/i],
  ['I', 'F.4', 'Farm owners', /farm ?owners?/i],
  ['I', 'F.5', 'Windstorm', /windstorm/i],

  // II. INSURANCE TERMS AND RELATED CONCEPTS (15)
  ['II', 'A.1', 'Law of Large Numbers', /law of large numbers/i],
  ['II', 'B', 'Insurable interest', /insurable interest/i],
  ['II', 'C.1', 'Pure vs speculative risk', /speculative/i],
  ['II', 'D.1', 'Moral hazard', /moral hazard/i],
  ['II', 'D.2', 'Morale hazard', /morale hazard/i],
  ['II', 'D.3', 'Physical hazard', /physical hazard/i],
  ['II', 'E', 'Peril', /\bperil/i],
  ['II', 'F.1', 'Direct loss', /direct loss/i],
  ['II', 'F.2', 'Indirect loss', /indirect loss|consequential loss/i],
  ['II', 'G.1', 'Actual cash value', /actual cash value|\bACV\b/i],
  ['II', 'G.2', 'Replacement cost', /replacement cost/i],
  ['II', 'G.3', 'Market value', /market value/i],
  ['II', 'G.4', 'Stated/agreed value', /stated (amount|value)|agreed (amount|value)/i],
  ['II', 'G.5', 'Salvage value', /salvage/i],
  ['II', 'H', 'Proximate cause', /proximate cause/i],
  ['II', 'I', 'Deductible', /deductible/i],
  ['II', 'J', 'Indemnity', /indemnit/i],
  ['II', 'K', 'Limits of liability', /limit of liability|limits of liability/i],
  ['II', 'L', 'Coinsurance / insurance to value', /coinsurance|insurance to value/i],
  ['II', 'M', 'Occurrence', /occurrence/i],
  ['II', 'N', 'Cancellation', /cancellation|cancel/i],
  ['II', 'O', 'Nonrenewal', /nonrenew|non-renew/i],
  ['II', 'P', 'Vacancy and unoccupancy', /vacan|unoccup/i],
  ['II', 'Q.1', 'Absolute liability', /absolute liability/i],
  ['II', 'Q.2', 'Strict liability', /strict liability/i],
  ['II', 'Q.3', 'Vicarious liability', /vicarious/i],
  ['II', 'R', 'Negligence', /negligen/i],
  ['II', 'S', 'Binder', /\bbinder/i],
  ['II', 'T', 'Endorsements', /endorsement/i],
  ['II', 'U', 'Blanket vs specific', /blanket/i],

  // III. POLICY PROVISIONS AND CONTRACT LAW (13)
  ['III', 'A', 'Declarations', /declarations/i],
  ['III', 'B', 'Insuring agreement', /insuring agreement/i],
  ['III', 'C', 'Conditions', /\bconditions\b/i],
  ['III', 'D', 'Exclusions', /exclusion/i],
  ['III', 'E', 'Definition of the insured', /who is an insured|definition of (the )?insured|named insured/i],
  ['III', 'F', 'Duties of the insured', /duties (of|after)/i],
  ['III', 'G', 'Obligations of the insurer', /obligations? of the (insurance company|insurer)|insurer'?s? (duty|duties|obligation)/i],
  ['III', 'H', 'Mortgagee rights', /mortgagee|mortgage clause/i],
  ['III', 'I', 'Proof of loss', /proof of loss/i],
  ['III', 'J', 'Notice of claim', /notice of (a )?(claim|loss)/i],
  ['III', 'K', 'Appraisal', /apprais/i],
  ['III', 'L', 'Other insurance provision', /other insurance/i],
  ['III', 'M', 'Subrogation', /subrogat/i],
  ['III', 'N', 'Elements of a contract', /elements of a contract/i],
  ['III', 'O', 'Warranties, representations, concealment', /concealment/i],
  ['III', 'P', 'Sources of underwriting information', /underwriting information|sources of underwriting/i],
  ['III', 'Q', 'Fair Credit Reporting Act', /fair credit reporting|\bFCRA\b/i],
  ['III', 'R', 'Privacy (Gramm-Leach-Bliley)', /gramm|\bGLBA\b/i],
  ['III', 'S', 'Policy application', /application/i],
  ['III', 'T', 'Terrorism Risk Insurance Act', /terrorism risk insurance|\bTRIA\b/i],
  ['III', 'U', 'Territory', /territor/i],

  // IV. TYPES OF POLICIES, BONDS, AND RELATED TERMS (23)
  ['IV', 'A.1.a', 'Premises and operations', /premises and operations/i],
  ['IV', 'A.1.b', 'Products and completed operations', /completed operations/i],
  ['IV', 'A.2.a', 'CGL Coverage A', /coverage a\b/i],
  ['IV', 'A.2.a', 'Occurrence vs claims-made, retroactive date', /claims-?made/i],
  ['IV', 'A.2.a', 'Retroactive date', /retroactive date/i],
  ['IV', 'A.2.b', 'CGL Coverage B (personal and advertising injury)', /advertising injury/i],
  ['IV', 'A.2.c', 'CGL Coverage C (medical payments)', /coverage c\b|medical payments/i],
  ['IV', 'A.2.d', 'Supplementary payments', /supplement(ary|al) payments/i],
  ['IV', 'A.2.f', 'First named insured', /first named insured/i],
  ['IV', 'A.2.g', 'Per occurrence and aggregate limits', /aggregate/i],
  ['IV', 'A.2.h', 'Damage to property of others', /(damage|property) (to|of) (property of )?others/i],
  ['IV', 'B.1.a', 'Bodily injury liability', /bodily injury/i],
  ['IV', 'B.1.b', 'Property damage liability', /property damage/i],
  ['IV', 'B.1.c', 'Split limits', /split limit/i],
  ['IV', 'B.1.d', 'Combined single limit', /combined single limit|\bCSL\b/i],
  ['IV', 'B.3', 'Physical damage: collision and OTC', /other than collision|comprehensive/i],
  ['IV', 'B.4', 'Uninsured motorists', /uninsured motorist/i],
  ['IV', 'B.5', 'Underinsured motorists', /underinsured motorist/i],
  ['IV', 'B.7.a', 'Owned auto', /owned auto/i],
  ['IV', 'B.7.b', 'Non-owned auto', /non-?owned/i],
  ['IV', 'B.7.c', 'Hired auto', /hired auto/i],
  ['IV', 'B.7.d', 'Temporary substitute', /temporary substitute/i],
  ['IV', 'B.7.e', 'Newly acquired autos', /newly acquired/i],
  ['IV', 'B.7.f', 'Transportation expense / rental reimbursement', /transportation expense|rental reimbursement/i],
  ['IV', 'B.8', 'Auto dealers / garagekeepers', /garagekeeper|auto dealer/i],
  ['IV', 'B.10', 'Drive Other Car', /drive other car|\bDOC\b/i],
  ['IV', 'B.11', 'Mobile equipment', /mobile equipment/i],
  ['IV', 'C.1.a', 'Who is an employee/employer', /\bemployee\b/i],
  ['IV', 'C.2', 'Work-related vs non-work-related', /work-?related/i],
  ['IV', 'C.4', 'Employers liability', /employers'? liability/i],
  ['IV', 'C.5', 'Exclusive remedy', /exclusive remedy/i],
  ['IV', 'C.6', 'Premium determination', /premium (determination|audit|basis)|payroll/i],
  ['IV', 'D.1', 'Employee dishonesty', /employee dishonesty/i],
  ['IV', 'D.2', 'Theft', /\btheft\b/i],
  ['IV', 'D.3', 'Robbery', /robbery/i],
  ['IV', 'D.4', 'Burglary', /burglary/i],
  ['IV', 'D.5', 'Forgery and alteration', /forgery/i],
  ['IV', 'D.6', 'Mysterious disappearance', /mysterious disappearance/i],
  ['IV', 'E.1', 'Surety bonds', /surety/i],
  ['IV', 'E.2', 'Fidelity bonds', /fidelity/i],
  ['IV', 'F.1', 'Errors and omissions', /errors and omissions|\bE&O\b/i],
  ['IV', 'F.2', 'Medical malpractice', /malpractice/i],
  ['IV', 'F.3', 'Directors and officers', /directors and officers|\bD&O\b/i],
  ['IV', 'F.4', 'Employment practices liability', /employment practices|\bEPLI\b/i],
  ['IV', 'F.5', 'Cyber liability and data breach', /data breach|cyber liab/i],
  ['IV', 'F.6', 'Liquor liability', /liquor liability|dram shop/i],
  ['IV', 'G', 'Umbrella / excess liability', /umbrella/i],
  ['IV', 'H', 'Business Owners Policy', /business ?owners? polic|\bBOP\b/i],

  // V. INSURANCE TERMS (casualty) (15) -- entries not already covered by II
  ['V', 'M', 'Deposit premium / audit', /deposit premium|premium audit/i],
  ['V', 'N', 'Certificate of insurance', /certificate of insurance/i],
  ['V', 'R.1.a', 'General damages', /general damages/i],
  ['V', 'R.1.b', 'Special damages', /special damages/i],
  ['V', 'R.2', 'Punitive damages', /punitive/i],

  // VI. POLICY PROVISIONS (casualty) (12) -- entries not already covered by III
  ['VI', 'M', 'Loss settlement / consent to settle', /consent to settle|loss settlement/i],

  // TX.I. TEXAS STATUTES COMMON TO P&C (18)
  ['TX.I', 'A.1', 'Commissioner general powers', /commissioner/i],
  ['TX.I', 'A.2', 'Examination of records', /examination and investigation|examination of insurer|examine the affairs/i],
  ['TX.I', 'A.3', 'Investigation / notice of hearing', /notice of hearing/i],
  ['TX.I', 'A.4', 'Penalties', /penalt/i],
  ['TX.I', 'A.5', 'Cease and desist orders', /cease and desist/i],
  ['TX.I', 'B.1', 'Certificate of authority', /certificate of authority/i],
  ['TX.I', 'B.2', 'Transacting insurance', /transacting insurance/i],
  ['TX.I', 'B.3', 'Foreign, domestic, alien', /\bdomestic\b.{0,40}\bforeign\b|\balien\b/i],
  ['TX.I', 'B.4', 'Stock, mutual', /mutual (insurer|company)/i],
  ['TX.I', 'B.5', 'Admitted / nonadmitted', /nonadmitted|non-admitted|admitted insurer/i],
  ['TX.I', 'B.6', 'Texas Lloyds', /lloyd/i],
  ['TX.I', 'C.1.a', 'Agent / agency licence', /agent licen[cs]e|agency licen[cs]e/i],
  ['TX.I', 'C.1.b', 'Nonresident agent', /nonresident|non-resident/i],
  ['TX.I', 'C.1.c', 'Temporary licence', /temporary licen[cs]e/i],
  ['TX.I', 'C.1.d', 'Limited licence', /limited licen[cs]e/i],
  ['TX.I', 'C.1.e', 'Managing general agent', /managing general agent|\bMGA\b/i],
  ['TX.I', 'C.1.f', 'Surplus lines licence', /surplus lines/i],
  ['TX.I', 'C.1.g', 'Adjuster', /adjuster/i],
  ['TX.I', 'C.1.h', 'Risk manager', /risk manager/i],
  ['TX.I', 'C.1.i', 'Emergency licence', /emergency licen[cs]e/i],
  ['TX.I', 'C.2', 'Exemptions / exceptions', /exempt/i],
  ['TX.I', 'C.3', 'Appointment', /appointment/i],
  ['TX.I', 'C.4', 'Continuing education', /continuing education/i],
  ['TX.I', 'C.5', 'Records maintenance', /records? (maintenance|retention)|maintain records/i],
  ['TX.I', 'C.6', 'Application, denial, renewal, expiration', /renewal/i],
  ['TX.I', 'C.7', 'Termination, revocation, suspension', /revocation|suspension|suspend/i],
  ['TX.I', 'C.8.a', 'Change of address', /change of (mailing )?address/i],
  ['TX.I', 'C.8.b', 'Felony convictions', /felony/i],
  ['TX.I', 'C.8.c', 'Administrative action notification', /administrative action/i],
  ['TX.I', 'D.1.a', 'Claims methods and practices', /claims? (method|practice)|unfair claim/i],
  ['TX.I', 'D.1.b', 'False advertising', /false advertising|advertis/i],
  ['TX.I', 'D.1.c', 'Misrepresentation', /misrepresent/i],
  ['TX.I', 'D.1.d', 'Defamation', /defamation/i],
  ['TX.I', 'D.1.e', 'Controlled business', /controlled business/i],
  ['TX.I', 'D.1.f', 'Rebating', /rebat/i],
  ['TX.I', 'D.1.g', 'Discrimination', /discriminat/i],
  ['TX.I', 'D.1.h', 'Fraud', /fraud/i],
  ['TX.I', 'D.1.i', 'Boycott, coercion, intimidation', /boycott|coercion|intimidat/i],
  ['TX.I', 'D.2', 'Rating and underwriting practices', /rating and underwriting|credit (information|scor)/i],
  ['TX.I', 'E.1', 'Commission sharing', /commission shar|sharing (a )?commission|4005\.05[34]|commission to (somebody|someone|a person) who is not licen/i],

  // TX.II. TEXAS STATUTES PERTINENT TO P&C (12)
  ['TX.II', 'A', 'Property and casualty definitions', /definition/i],
  ['TX.II', 'B', 'Surplus lines', /surplus lines/i],
  ['TX.II', 'C', 'Approval of rates and forms', /rate.{0,20}(filing|approval)|form.{0,20}(filing|approval)|file and use/i],
  ['TX.II', 'D.1', 'Declination, cancellation, nonrenewal', /declination|declin/i],
  ['TX.II', 'D.2', 'Texas FAIR Plan Association', /fair plan/i],
  ['TX.II', 'D.3', 'Texas Windstorm Insurance Association', /\bTWIA\b|windstorm insurance association/i],
  ['TX.II', 'D.4', 'Loss settlement provisions', /prompt payment|loss settlement/i],
  ['TX.II', 'D.5', 'Liquidated demand', /liquidated demand/i],
  ['TX.II', 'E.1.a', 'Auto coverage', /personal auto|auto polic/i],
  ['TX.II', 'E.1.b', 'UM / UIM', /uninsured motorist/i],
  ['TX.II', 'E.1.c', 'Personal Injury Protection', /personal injury protection|\bPIP\b/i],
  ['TX.II', 'E.2', 'Financial responsibility / minimum limits', /financial responsibility|30\/60\/25/i],
  ['TX.II', 'E.3', 'Auto renewal, nonrenewal, cancellation', /nonrenew/i],
  ['TX.II', 'E.4', 'Texas Automobile Insurance Plan Association', /\bTAIPA\b|automobile insurance plan/i],
  ['TX.II', 'E.5', 'Transportation network company (rideshare)', /rideshare|transportation network/i],
  ['TX.II', 'F.1', 'Workers comp definitions and coverage', /workers'? compensation/i],
  ['TX.II', 'F.2', 'Workers comp benefits', /income benefit|impairment (income )?benefit/i],
  ['TX.II', 'G', 'Guaranty Association', /guaranty association/i],
  ['TX.II', 'H', 'Medical Liability JUA', /\bJUA\b|joint underwriting/i],
]

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return walk(full)
    return e.name.endsWith('.md') && /^\d\d-/.test(e.name) ? [full] : []
  })
}

const lessonFiles = walk(LESSONS).map((f) => [f, readFileSync(f, 'utf8')])
const questionFiles = walk(QUESTIONS).map((f) => [f, readFileSync(f, 'utf8')])

const rows = OUTLINE.map(([section, line, label, pattern]) => {
  const lessons = lessonFiles.filter(([, t]) => pattern.test(t))
  const questions = questionFiles.filter(([, t]) => pattern.test(t))
  return { section, line, label, lessons: lessons.length, questions: questions.length,
           where: lessons.map(([f]) => f.slice(LESSONS.length + 1)) }
})

const untaught = rows.filter((r) => r.lessons === 0)
const unasked = rows.filter((r) => r.lessons > 0 && r.questions === 0)

if (MARKDOWN) {
  let current = null
  for (const r of rows) {
    if (r.section !== current) {
      console.log(`\n### ${r.section}\n`)
      console.log('| Line | Outline entry | Lessons | Questions |')
      console.log('| --- | --- | ---: | ---: |')
      current = r.section
    }
    const mark = r.lessons === 0 ? ' **NOT TAUGHT**' : r.questions === 0 ? ' *(no question)*' : ''
    console.log(`| ${r.line} | ${r.label}${mark} | ${r.lessons} | ${r.questions} |`)
  }
  console.log()
}

console.log(`${rows.length} outline entries checked against ${lessonFiles.length} lessons and ${questionFiles.length} question files.`)
console.log(`  taught and questioned : ${rows.length - untaught.length - unasked.length}`)
console.log(`  taught, no question   : ${unasked.length}`)
console.log(`  not taught            : ${untaught.length}`)

if (untaught.length > 0) {
  console.log('\nNo lesson matches these outline entries:')
  for (const r of untaught) console.log(`  ${r.section}.${r.line.padEnd(6)} ${r.label}`)
  console.log('\nA miss here is more often a wording difference than a gap -- the course')
  console.log('writes "farmowners" as one word and abbreviates BOP and NFIP. Read the')
  console.log('lesson before writing a new one.')
}

if (unasked.length > 0) {
  console.log('\nTaught, but no question anywhere:')
  for (const r of unasked) console.log(`  ${r.section}.${r.line.padEnd(6)} ${r.label}  (${r.where[0] ?? ''})`)
}

if (MAX !== null && untaught.length > MAX) {
  console.error(`\n${untaught.length} untaught entr(ies), ceiling is ${MAX}.`)
  process.exit(1)
}
