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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { classifyReview } from './review-gate.mjs'

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
    reviewed: review.reviewed,
    questions,
  })
}

if (problems.length) {
  console.error('Question problems:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}

const total = files.reduce((sum, f) => sum + f.questions.length, 0)
const unreviewed = files.filter((f) => !f.reviewed)
console.log(`${total} question(s) across ${files.length} file(s)`)
console.log(`  reviewed and publishable: ${total - unreviewed.reduce((s, f) => s + f.questions.length, 0)}`)
console.log(`  held as draft (UNREVIEWED): ${unreviewed.reduce((s, f) => s + f.questions.length, 0)}`)
for (const f of unreviewed) console.log(`    · ${f.relative} (${f.questions.length})`)

if (CHECK_ONLY) process.exit(0)

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

writeFileSync(OUT, out.join('\n'))
console.log(`\nwrote ${OUT.slice(ROOT.length + 1)} (${out.length} lines)`)
