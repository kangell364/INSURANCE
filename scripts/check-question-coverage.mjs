#!/usr/bin/env node
/**
 * Every term a lesson DEFINES should be the correct answer to a question.
 *
 * WHY THIS EXISTS
 *
 * A single night's review found the same defect in six separate files. The
 * lesson defined a set of terms; the question bank made some of them
 * answerable and left the rest as scenery:
 *
 *   - insurer classifications  foreign and alien were answers, DOMESTIC never
 *   - agent authority          apparent was an answer, EXPRESS and IMPLIED never
 *   - risk management          reduction and avoidance were answers, RETENTION,
 *                              TRANSFER and SHARING never
 *   - contract elements        offer and consideration were answers, COMPETENT
 *                              PARTIES and LEGAL PURPOSE never
 *   - characteristics          four of six were answers
 *   - waiver and estoppel      estoppel was an answer, WAIVER never
 *
 * Each one lets a student pattern-match: learn the two that get asked, and the
 * questions all come out right while half the distinction is never examined.
 * None of it is visible reading a lesson, or reading one question. It only
 * appears when you read every ANSWER in a file together, which is not
 * something anybody does by hand twice.
 *
 * WHAT IT DOES NOT CLAIM
 *
 * It matches text, so it cannot tell that a term is *well* examined -- only
 * that it is examined at all. A term whose only question is trivial passes.
 * That is still worth having: the failure it catches is total absence, which
 * is what we kept finding.
 *
 * Terms deliberately not tested -- off-blueprint asides, cross-references to
 * other modules -- go in UNTESTED with a reason. An allowlist with reasons is
 * the difference between a check somebody maintains and one they silence.
 *
 *   node scripts/check-question-coverage.mjs           # report
 *   node scripts/check-question-coverage.mjs --verbose # and list what passed
 *   node scripts/check-question-coverage.mjs --strict  # exit 1 on any miss
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..')
const LESSONS = join(ROOT, 'content', 'texas-general-lines-property-casualty')
const QUESTIONS = join(
  ROOT, 'content', 'questions', 'texas-general-lines-property-casualty',
)
const VERBOSE = process.argv.includes('--verbose')
const STRICT = process.argv.includes('--strict')

/**
 * A ratchet, not a gate.
 *
 * There are dozens of these already, and failing the build on all of them
 * today would mean deleting the check by Tuesday. --max takes the count CI
 * currently tolerates: the number may fall, never rise. Same shape as
 * TEP_MIN_ASSERTIONS in the RLS harness, for the same reason -- a threshold
 * somebody can move in one direction is a threshold that survives.
 */
const MAX_ARG = process.argv.indexOf('--max')
const MAX = MAX_ARG === -1 ? null : Number(process.argv[MAX_ARG + 1])

/**
 * Terms a lesson defines but deliberately does not test, with the reason.
 *
 * Keyed "<lesson-file>::<term>". A bare term with no reason is not accepted --
 * writing the reason is the point, because it forces somebody to decide rather
 * than to quieten.
 */
const UNTESTED = new Map([
  [
    '03-licensing-and-appointment.md::explain the coverage',
    'An item in a list of producer duties, not a term. The list is examined ' +
      'collectively -- which of these is NOT a duty -- so the answer is the ' +
      'odd one out, and no question can have "explain the coverage" as its answer.',
  ],
  [
    '07-terms-the-other-lessons-assume.md::personal auto policy',
    'Extracted from "**A personal auto policy is both.**", which applies the ' +
      'property/casualty split rather than defining the policy. The auto ' +
      'policy itself is taught and examined in Module 4.',
  ],
  [
    '07-elements-of-a-contract.md::reasonable expectations',
    'Not on either Texas outline. Recorded beside adhesion because it explains ' +
      'the signed rejection of UM coverage in Module 5; testing it would be padding.',
  ],
])

/**
 * Definition shapes, deliberately narrow.
 *
 * Emphasis is used throughout these lessons for stress, not only for
 * definition, so matching every bolded phrase would bury the real findings in
 * noise. These three patterns are how the lessons actually introduce a term,
 * and missing a few definitions is much cheaper than a report nobody reads.
 */
const PATTERNS = [
  /^\*\*([^*]{2,40})\.\*\*\s/,              // **Adhesion.** One party writes it
  /^-\s+\*\*([^*]{2,40})\*\*\s+[—-]\s/,     // - **Retention** — accept it
  /^\*\*([^*]{2,40})\*\*\s+(?:is|means)\s/, // **A peril** is the cause of loss
  // A whole sentence in bold, which is how several definitions are written:
  // "**A direct loss is physical damage to property caused by a peril.**"
  // Without this the term is the entire sentence, rejected as too long, and
  // the definition is invisible. Direct and indirect loss -- a blueprint term
  // at GK II.F -- went unexamined and unreported because of exactly that.
  /^\*\*(?:A|An|The)\s+([a-z][^*]{2,28}?)\s+(?:is|are|means)\s[^*]*\*\*/,
]

/**
 * Bolded emphasis that opens a sentence rather than naming a term. The
 * lessons stress conclusions this way -- "**Both limbs are required.**",
 * "**Silence is covered.**" -- and those are not things a question can have
 * as an answer.
 */
const SENTENCE_START = new Set([
  'as', 'both', 'silence', 'did', 'should', 'one', 'two', 'what', 'where',
  'when', 'how', 'why', 'nothing', 'everything', 'every', 'each', 'if', 'so',
  'that', 'this', 'these', 'those', 'there', 'note', 'read', 'ask', 'work',
  'learn', 'do', 'it', 'they', 'you', 'we', 'his', 'her', 'their', 'no',
  'not', 'only', 'any', 'all', 'some', 'most', 'more', 'less', 'never',
  'always', 'again', 'still', 'then', 'now',
])

/**
 * Generic nouns that open an explanatory sentence rather than name a term.
 * "**The test is attachment, not size.**" defines nothing; it applies
 * something already defined. Without this the bolded-sentence pattern
 * extracts "test" from half the lessons.
 */
const GENERIC = new Set([
  'test', 'point', 'answer', 'rule', 'reason', 'question', 'difference',
  'distinction', 'result', 'effect', 'consequence', 'trap', 'catch', 'idea',
  'shape', 'whole', 'key', 'thing', 'part', 'half', 'order', 'exam', 'stem',
  'insured', 'insurer', 'policy', 'student', 'producer', 'agent',
])

/** Structural references, not defined terms. */
const STRUCTURAL = /^(subchapter|chapter|section|article|side|part|coverage)\s+[A-Z0-9]/i

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'to', 'is', 'are', 'that', 'this',
  'for', 'with', 'be', 'it', 'its', 'as', 'at', 'by', 'from', 'on',
])

function normalise(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Loose stem: enough to match waiver/waived, not enough to match retain/retention. */
function stem(word) {
  return word.length > 5 ? word.slice(0, 5) : word
}

function mentions(answerText, term) {
  const answer = normalise(answerText)
  const words = normalise(term).split(' ').filter((w) => w && !STOP.has(w))
  if (words.length === 0) return true
  const answerStems = new Set(answer.split(' ').map(stem))
  return words.every((w) => answerStems.has(stem(w)))
}

function lessonFiles() {
  return readdirSync(LESSONS)
    .filter((d) => !d.startsWith('.'))
    .flatMap((mod) =>
      readdirSync(join(LESSONS, mod))
        .filter((f) => f.endsWith('.md'))
        .map((f) => ({ module: mod, file: f })),
    )
}

function termsIn(body) {
  const found = new Map()
  // Only the teaching body: a term first named in "How this is examined" or
  // "Check yourself" is being revised, not introduced.
  const teaching = body.split(/^## (?:How this is examined|Check yourself)/m)[0]
  for (const line of teaching.split('\n')) {
    for (const re of PATTERNS) {
      const m = line.match(re)
      if (!m) continue
      const term = m[1].trim().replace(/\s*\([^)]*\)\s*$/, '')
      if (term.split(/\s+/).length > 3) continue     // a sentence, not a term
      if (/[§\d]/.test(term)) continue               // a citation, not a term
      if (SENTENCE_START.has(normalise(term).split(' ')[0])) continue
      if (GENERIC.has(normalise(term))) continue
      if (STRUCTURAL.test(term)) continue            // "Subchapter C", "Side B"
      if (!found.has(normalise(term))) found.set(normalise(term), term)
      break
    }
  }
  return [...found.values()]
}

function correctAnswers(text) {
  return text
    .split('\n')
    .filter((l) => l.startsWith('- [x]'))
    .map((l) => l.slice(5).trim())
}

/**
 * Stems that ASK for the term, which examine it just as well as an answer
 * that names it: "What is actual cash value?" answered by "replacement cost
 * less depreciation" is a question about ACV, and reporting it as untested
 * was this check's first false positive.
 *
 * Deliberately narrow. Any stem MENTIONING the term would be far too
 * permissive -- "Domestic, foreign or alien?" mentions domestic, and that
 * question resolving to "foreign" is precisely the gap this exists to find.
 * Only a stem whose SUBJECT is the term counts.
 */
function definitionStems(text) {
  return text
    .split('\n')
    .filter((l) => l.startsWith('### '))
    .map((l) => l.slice(4).trim())
}

function asksFor(stem, term) {
  const t = normalise(term).split(' ').filter((w) => w && !STOP.has(w)).join(' ')
  if (!t) return false
  const s = normalise(stem)
  const subject = [
    `what is ${t}`, `what are ${t}`, `what does ${t}`,
    `what is a ${t}`, `what is an ${t}`, `what is the ${t}`,
    `which term describes ${t}`, `define ${t}`,
  ]
  return subject.some((form) => s.includes(form))
}

// Every correct answer and every stem in the course, read once.
const allBankText = readdirSync(QUESTIONS)
  .filter((d) => !d.startsWith('.'))
  .flatMap((mod) =>
    readdirSync(join(QUESTIONS, mod))
      .filter((f) => f.endsWith('.md'))
      .map((f) => readFileSync(join(QUESTIONS, mod, f), 'utf8')),
  )
const answers = allBankText.flatMap(correctAnswers)
const stems = allBankText.flatMap(definitionStems)

let checked = 0
let missing = []
let allowed = 0

for (const { module, file } of lessonFiles()) {
  const lessonBody = readFileSync(join(LESSONS, module, file), 'utf8')
  // Search the WHOLE COURSE's banks, not one file and not one module.
  //
  // The question is "is this term examined anywhere a student will meet it",
  // and modules are an authoring convenience rather than a wall. Pairing file
  // to file reported "avoidance" missing because it is defined in How
  // Insurance Works and asked in Risk, Peril and Hazard. Scoping to the
  // module then reported "other insurance" missing from Module 2, while
  // Module 1 asks which provision prevents an insured profiting from a loss
  // and answers "the other insurance clause".
  //
  // Both were the check being wrong in the direction that wastes a person's
  // evening, which is the direction that gets a check deleted.

  for (const term of termsIn(lessonBody)) {
    checked += 1
    const key = `${file}::${normalise(term)}`
    if (UNTESTED.has(key)) {
      allowed += 1
      continue
    }
    const examined =
      answers.some((a) => mentions(a, term)) ||
      stems.some((q) => asksFor(q, term))
    if (!examined) {
      missing.push({ module, file, term })
    } else if (VERBOSE) {
      console.log(`  ok    ${file}: ${term}`)
    }
  }
}

console.log(
  `\n${checked} defined term(s) across the lessons; ` +
    `${allowed} deliberately untested.`,
)

if (missing.length === 0) {
  console.log('Every defined term is the correct answer to a question.')
  process.exit(0)
}

const byModule = new Map()
for (const m of missing) {
  if (!byModule.has(m.module)) byModule.set(m.module, [])
  byModule.get(m.module).push(m)
}

console.log(`\n${missing.length} defined term(s) are never a correct answer:\n`)
for (const [module, items] of [...byModule].sort()) {
  console.log(`  ${module}`)
  const byFile = new Map()
  for (const i of items) {
    if (!byFile.has(i.file)) byFile.set(i.file, [])
    byFile.get(i.file).push(i.term)
  }
  for (const [file, terms] of [...byFile].sort()) {
    console.log(`    ${file}`)
    for (const t of terms) console.log(`      · ${t}`)
  }
}
console.log(
  `\nEither write a question whose correct answer is the term, or add it to\n` +
    `UNTESTED in this script WITH A REASON.`,
)

if (MAX !== null) {
  if (missing.length > MAX) {
    console.error(
      `\n${missing.length} untested term(s), and the ceiling is ${MAX}.\n` +
        `A term was defined without a question, or a question that covered ` +
        `one was changed.`,
    )
    process.exit(1)
  }
  if (missing.length < MAX) {
    console.log(
      `\nBelow the ceiling of ${MAX}. Lower it to ${missing.length} in ` +
        `.github/workflows/ci.yml so the ground gained is held.`,
    )
  }
}
process.exit(STRICT && missing.length > 0 ? 1 : 0)
