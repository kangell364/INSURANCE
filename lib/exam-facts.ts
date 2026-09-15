/**
 * Verified facts about the Texas General Lines Property & Casualty exam.
 *
 * EVERY VALUE HERE IS TRANSCRIBED FROM A NAMED PRIMARY SOURCE. Nothing is
 * recalled, inferred, or taken from a third-party summary. `source` on each
 * group says which document, so a reader can check a figure without trusting
 * this file.
 *
 * Why constants rather than prose in the page: these numbers appear in more
 * than one place — the exam-day page, the course pages, eventually marketing
 * copy — and a fee quoted in three files is a fee that will be wrong in two
 * of them the first time it changes. See docs/exam-facts.md for the fuller
 * record, including what the sources DO NOT say.
 *
 * When Pearson VUE publishes a new edition, update this file and
 * docs/exam-facts.md together, and re-check EXAM_FACTS_VERIFIED_ON.
 */

/** The edition of the sources these facts were read from. */
export const EXAM_FACTS_SOURCES = {
  contentOutline: 'Pearson VUE publication #124401, effective 1 September 2026',
  candidateHandbook: 'Pearson VUE publication #124400, Texas Candidate Handbook',
  passRates: 'Pearson VUE Examination Pass Rates, 1–31 August 2026',
} as const

export const EXAM_FACTS_VERIFIED_ON = '2026-09-15'

export const EXAM = {
  name: 'General Lines — Property & Casualty',
  /** Pearson VUE's code for the English-language form. */
  code: 'InsTX-PC06',
  minutes: 150,
  /** US dollars, paid to Pearson VUE at the time of reservation. */
  feeUsd: 49,
  /** US dollars, paid to the Texas Department of Insurance per licence type. */
  licenceApplicationFeeUsd: 50,
  scoredQuestions: 130,
  pretestQuestions: 15,
  totalQuestions: 145,
  generalKnowledgeQuestions: 100,
  stateSpecificQuestions: 30,
  /** Minutes before the appointment a candidate must arrive. */
  arriveMinutesEarly: 30,
  /** Hours of notice required to change or cancel without forfeiting the fee. */
  cancelNoticeHours: 48,
  /** Months within which the licence application must follow a pass. */
  applyWithinMonths: 12,
  /** Days a temporary General Lines licence lasts. It cannot be renewed. */
  temporaryLicenceDays: 180,
} as const

/**
 * August 2026 outcomes for this exam, by attempt type.
 *
 * The repeater row is the one that matters commercially and pedagogically:
 * candidates who have already failed once pass at a markedly LOWER rate than
 * first-timers. See docs/competitor-research.md.
 */
export const PASS_RATES = {
  firstTime: { graded: 1057, passed: 646, ratePercent: 61 },
  repeat: { graded: 765, passed: 290, ratePercent: 38 },
} as const

/** The blueprint, as published: section titles and their scored questions. */
export const BLUEPRINT: readonly {
  code: string
  name: string
  questions: number
}[] = [
  { code: 'I', name: 'Types of Policies', questions: 22 },
  { code: 'II', name: 'Insurance Terms and Related Concepts', questions: 15 },
  { code: 'III', name: 'Policy Provisions and Contract Law', questions: 13 },
  {
    code: 'IV',
    name: 'Types of Policies, Bonds, and Related Terms',
    questions: 23,
  },
  {
    code: 'V',
    name: 'Insurance Terms and Related Concepts (casualty)',
    questions: 15,
  },
  { code: 'VI', name: 'Policy Provisions (casualty)', questions: 12 },
  {
    code: 'TX.I',
    name: 'Texas Statutes and Rules Common to Property and Casualty Insurance',
    questions: 18,
  },
  {
    code: 'TX.II',
    name: 'Texas Statutes and Rules Pertinent to Property and Casualty Insurance',
    questions: 12,
  },
]

/** Identification accepted as the PRIMARY document. */
export const PRIMARY_ID = [
  'Driver licence',
  'Passport',
  'Passport card',
  'Military ID',
  'Military ID for spouses and dependents',
  'Alien Registration Card (green card, permanent resident visa)',
  'U.S. Department of State identification',
] as const

/** Identification accepted as the SECONDARY document. */
export const SECONDARY_ID = [
  'U.S. Social Security card',
  'Debit (ATM) card',
  'Credit card',
  'Any document from the primary list',
] as const

/** Reasons the handbook lists as excusing an absence, with documentation. */
export const EXCUSED_ABSENCE_REASONS = [
  'A death in the immediate family',
  'A disabling traffic accident',
  'A court appearance or jury duty',
  'Military duty',
  'A weather emergency',
] as const
