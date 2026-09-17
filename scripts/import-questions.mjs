#!/usr/bin/env node
/**
 * Turn the Markdown question files in content/questions/ into loadable SQL.
 *
 * THE RULE THIS SCRIPT EXISTS TO ENFORCE, as with lessons:
 *
 *   A question file whose front matter still says UNREVIEWED is written out as
 *   DRAFT, whatever it asks for. Draft questions are invisible to students and
 *   are never drawn into a paper.
 *
 * The reasoning is stronger here than for lessons. A lesson that is wrong
 * misleads a student; a wrong answer key marks a correct answer WRONG, and the
 * student will believe the material over themselves.
 *
 *   node scripts/import-questions.mjs          # writes supabase/seed_questions.sql
 *   node scripts/import-questions.mjs --check  # report only, write nothing
 *
 * Exits non-zero on any malformed question, so it can gate CI.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { classifyReview, verifyFingerprint } from './review-gate.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const CONTENT = join(ROOT, 'content', 'questions')
const OUT = join(ROOT, 'supabase', 'seed_questions.sql')
const CHECK_ONLY = process.argv.includes('--check')

function uuidFor(kind, key) {
  const hash = createHash('sha1').update(`${kind}:${key}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

function sql(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

function parseFrontMatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return null
  const meta = {}
  for (const line of text.slice(4, end).split('\n')) {
    const at = line.indexOf(':')
    if (at === -1) continue
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { meta, body: text.slice(end + 5).trim() }
}

/**
 * Documentation files sitting alongside content: README.md, REVIEW.md,
 * COURSE-MAP.md. Lesson and question files are lowercase and start with a
 * two-digit order, so an ALL-CAPS basename is never content. Naming each one
 * individually meant every new doc broke the importer until somebody added it
 * to the list -- REVIEW.md did exactly that.
 */
function isDoc(file) {
  return /^[A-Z][A-Z0-9-]*\.md$/.test(basename(file))
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.md') && !isDoc(full) ? [full] : []
  })
}

const OPTION = /^-\s*\[( |x|X)\]\s+(.*)$/

/**
 * Splits a body into questions.
 *
 * A question is a run of `###` heading lines (so a long stem can wrap across
 * several), then its options, then an optional explanation paragraph.
 */
function parseQuestions(body, relative, problems) {
  const questions = []
  const lines = body.split('\n')
  let i = 0

  while (i < lines.length) {
    if (!lines[i].startsWith('### ')) {
      i += 1
      continue
    }

    const stemLines = []
    while (i < lines.length && lines[i].startsWith('### ')) {
      stemLines.push(lines[i].slice(4).trim())
      i += 1
    }

    const options = []
    let correct = -1
    while (i < lines.length) {
      if (lines[i].trim() === '') {
        // A blank line inside the option block is tolerated; one after the
        // block ends it.
        if (options.length > 0 && !OPTION.test((lines[i + 1] ?? '').trim())) break
        i += 1
        continue
      }
      const match = OPTION.exec(lines[i].trim())
      if (!match) break
      if (match[1].toLowerCase() === 'x') {
        if (correct !== -1) {
          problems.push(
            `${relative}: "${stemLines[0].slice(0, 60)}…" marks more than one option correct`,
          )
        }
        correct = options.length
      }
      options.push(match[2].trim())
      i += 1
    }

    const explanation = []
    while (i < lines.length && !lines[i].startsWith('### ')) {
      if (lines[i].trim() !== '') explanation.push(lines[i].trim())
      i += 1
    }

    const stem = stemLines.join(' ')
    if (options.length < 2) {
      problems.push(`${relative}: "${stem.slice(0, 60)}…" has fewer than two options`)
      continue
    }
    if (correct === -1) {
      // The failure mode this catches is the worst one available: a question
      // with no key cannot be scored, and a silent import would put it into
      // papers where every answer is wrong.
      problems.push(`${relative}: "${stem.slice(0, 60)}…" marks no option correct`)
      continue
    }

    questions.push({
      stem,
      options,
      correct,
      explanation: explanation.join(' ') || null,
    })
  }

  return questions
}

const problems = []
const staleReviews = []
const unhashedReviews = []
const files = []

for (const file of walk(CONTENT).sort()) {
  const relative = file.slice(CONTENT.length + 1)
  const parsed = parseFrontMatter(readFileSync(file, 'utf8'))
  if (!parsed) {
    problems.push(`${relative}: no front matter`)
    continue
  }

  const { meta, body } = parsed
  for (const required of ['course', 'topic', 'review']) {
    if (!meta[required]) problems.push(`${relative}: missing "${required}"`)
  }
  if (problems.length) continue

  const review = classifyReview(meta.review)
  if (review.problem) {
    problems.push(`${relative}: ${review.problem}`)
    continue
  }

  // Same rule as lessons: a sign-off covers the words that existed when it
  // was made. A question whose text or answer key changed afterwards is not
  // reviewed, whatever the line says -- and a changed ANSWER KEY is the exact
  // failure this whole gate exists to prevent.
  const fingerprint = verifyFingerprint(review, body)
  if (review.reviewed && !fingerprint.ok) {
    staleReviews.push(`${relative}: ${fingerprint.reason}`)
  } else if (fingerprint.reason) {
    unhashedReviews.push(`${relative}: ${fingerprint.reason}`)
  }

  const questions = parseQuestions(body, relative, problems)
  if (questions.length === 0) {
    problems.push(`${relative}: no questions found`)
    continue
  }

  files.push({
    relative,
    courseSlug: meta.course,
    topicCode: meta.topic,
    lessonSlug: meta.lesson || null,
    reviewed: review.reviewed && fingerprint.ok,
    questions,
  })
}

if (problems.length) {
  console.error('Question problems:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}

const total = files.reduce((sum, f) => sum + f.questions.length, 0)
// Two questions with the same stem get the same id, and every insert carries
// `on conflict (id) do update`, so the second silently overwrites the first.
// The script then reports the number it counted while the database holds one
// row fewer, and nothing anywhere says so.
//
// Found the only way it could be: production reported 611 questions after a
// seed this script had called 612. The duplicate was the same auto-limits
// question written into two Module 5 lessons months apart.
//
// A deterministic id is the right choice -- it makes a re-import update a
// question rather than duplicate it -- but it means duplicate STEMS have to
// be caught here, because the database cannot tell them apart.
// The key must match uuidFor('question', ...) below EXACTLY. Deriving it a
// second way here would let the two disagree, and a duplicate check that
// disagrees with the id it is checking is worse than none.
const byId = new Map()
const collisions = []
for (const f of files) {
  for (const q of f.questions) {
    const id = uuidFor('question', `${f.courseSlug}/${q.stem}`)
    const seen = byId.get(id)
    if (seen) {
      collisions.push(
        `  - ${q.stem.slice(0, 70)}${q.stem.length > 70 ? '…' : ''}\n` +
          `      ${seen}\n      ${f.relative}`,
      )
    } else {
      byId.set(id, f.relative)
    }
  }
}
if (collisions.length > 0) {
  console.error(
    `Duplicate question(s) -- identical text, so only one would survive ` +
      `the seed:\n${collisions.join('\n')}\n\n` +
      `Reword or remove one of each pair.`,
  )
  process.exit(1)
}

if (staleReviews.length > 0) {
  console.error(
    `\nSIGNED OFF, THEN EDITED -- held as drafts:\n` +
      staleReviews.map((p) => `  - ${p}`).join('\n') +
      `\n\nA changed answer key under somebody else's sign-off is the worst\n` +
      `thing this gate can miss. Re-read and re-sign:\n` +
      `  node scripts/review-module.mjs --module NN --reviewer "Name"`,
  )
  process.exit(1)
}

if (unhashedReviews.length > 0) {
  console.log(
    `\n${unhashedReviews.length} sign-off(s) carry no content hash, so a later ` +
      `edit to them cannot be detected.\nRe-sign to add one.`,
  )
}

const unreviewed = files.filter((f) => !f.reviewed)
console.log(`${total} question(s) across ${files.length} file(s)`)
console.log(`  reviewed and publishable: ${total - unreviewed.reduce((s, f) => s + f.questions.length, 0)}`)
console.log(`  held as draft (UNREVIEWED): ${unreviewed.reduce((s, f) => s + f.questions.length, 0)}`)
for (const f of unreviewed) console.log(`    · ${f.relative} (${f.questions.length})`)

// --check used to exit HERE, before generating anything, so it validated the
// Markdown and never looked at the SQL built from it. seed_questions.sql was
// 4,604 lines behind content/questions/ with CI green throughout -- the
// Module 5 questions written last were simply not in the file anybody would
// deploy. Generation now always runs, and --check compares the result against
// what is committed.


const out = []
out.push('-- GENERATED by scripts/import-questions.mjs — do not edit by hand.')
out.push('-- Source of truth is content/questions/.')
out.push('--')
out.push('-- Questions whose front matter says UNREVIEWED are written as drafts,')
out.push('-- which are invisible to students and never drawn into a paper.')
out.push('')

for (const f of files) {
  for (const q of f.questions) {
    const qid = uuidFor('question', `${f.courseSlug}/${q.stem}`)
    const status = f.reviewed ? 'active' : 'draft'

    out.push(`insert into public.questions`)
    out.push(`  (id, course_id, topic_id, lesson_id, stem, explanation, status)`)
    out.push(`select ${sql(qid)}, c.id, t.id,`)
    out.push(
      f.lessonSlug
        ? `       (select l.id from public.lessons l where l.course_id = c.id and l.slug = ${sql(f.lessonSlug)}),`
        : `       null,`,
    )
    out.push(`       ${sql(q.stem)}, ${sql(q.explanation)}, ${sql(status)}`)
    out.push(`  from public.courses c`)
    out.push(`  join public.topics t on t.course_id = c.id and t.code = ${sql(f.topicCode)}`)
    out.push(` where c.slug = ${sql(f.courseSlug)}`)
    out.push(`on conflict (id) do update set`)
    out.push(`  stem = excluded.stem, explanation = excluded.explanation,`)
    out.push(`  status = excluded.status, topic_id = excluded.topic_id;`)
    out.push('')

    q.options.forEach((body, index) => {
      const oid = uuidFor('option', `${qid}/${index}`)
      out.push(`insert into public.question_options (id, question_id, course_id, body, position)`)
      out.push(`select ${sql(oid)}, ${sql(qid)}, c.id, ${sql(body)}, ${index + 1}`)
      out.push(`  from public.courses c where c.slug = ${sql(f.courseSlug)}`)
      out.push(`on conflict (id) do update set body = excluded.body;`)
      out.push('')
    })

    const correctId = uuidFor('option', `${qid}/${q.correct}`)
    out.push(`insert into public.question_answers (question_id, course_id, correct_option_id)`)
    out.push(`select ${sql(qid)}, c.id, ${sql(correctId)}`)
    out.push(`  from public.courses c where c.slug = ${sql(f.courseSlug)}`)
    out.push(`on conflict (question_id) do update set`)
    out.push(`  correct_option_id = excluded.correct_option_id;`)
    out.push('')
  }
}

const body = out.join('\n')
const relative = OUT.slice(ROOT.length + 1)

if (CHECK_ONLY) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== body) {
    console.error(
      `\n${relative} is out of date with content/questions/.\n` +
        `Run: node scripts/import-questions.mjs`,
    )
    process.exit(1)
  }
  console.log(`\n${relative}: up to date`)
} else {
  writeFileSync(OUT, body)
  console.log(`\nwrote ${relative} (${out.length} lines)`)
}
