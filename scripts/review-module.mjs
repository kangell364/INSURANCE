#!/usr/bin/env node
/**
 * Sign a module off, or take a sign-off back.
 *
 * Review happens module by module, so a finished module can reach students
 * while the rest waits. Doing that by hand means editing up to twenty
 * front-matter lines per module -- ten lessons and ten question files -- and
 * the review gate is unforgiving by design: a line that is neither a valid
 * sign-off nor an explicit UNREVIEWED is rejected outright.
 *
 * So this writes the line for you, in the one shape the gate accepts.
 *
 * It deliberately does NOT read your name from git config. Signing a module
 * off is a statement that a qualified person read every question in it and
 * stands behind the answer key. That should be typed on purpose.
 *
 *   node scripts/review-module.mjs --status
 *   node scripts/review-module.mjs --module 01 --reviewer "Jane Doe"
 *   node scripts/review-module.mjs --module 01 --reviewer "Jane Doe" --questions-only
 *   node scripts/review-module.mjs --module 01 --undo
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { classifyReview, contentFingerprint } from './review-gate.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const CONTENT = join(ROOT, 'content')
const QUESTIONS = join(CONTENT, 'questions')

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1] ?? null
}
const has = (name) => process.argv.includes(`--${name}`)

function die(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

/** Every course directory under a root, skipping `questions/` itself. */
function courseDirs(root) {
  return readdirSync(root)
    .filter((e) => e !== 'questions' && !e.startsWith('.'))
    .map((e) => join(root, e))
    .filter((p) => statSync(p).isDirectory())
}

/** Module directories matching a two-digit prefix, across both trees. */
function moduleDirs(prefix) {
  const found = []
  for (const root of [CONTENT, QUESTIONS]) {
    for (const course of courseDirs(root)) {
      for (const entry of readdirSync(course)) {
        const full = join(course, entry)
        if (!statSync(full).isDirectory()) continue
        if (!entry.startsWith(`${prefix}-`)) continue
        found.push({ kind: root === QUESTIONS ? 'questions' : 'lessons', dir: full, name: entry })
      }
    }
  }
  return found
}

function markdownIn(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('README') && f !== 'COURSE-MAP.md')
    .map((f) => join(dir, f))
}

/** Rewrites the `review:` line inside the front matter only. */
/**
 * Write the review line, fingerprinting the body as it goes.
 *
 * The hash is computed HERE, at the moment of signing, against the body as it
 * stands. That is the whole point: it records what the reviewer was looking
 * at. Any later edit changes the body, the hashes disagree, and the importer
 * holds the file instead of publishing somebody's name over text they never
 * read.
 */
function setReviewLine(file, value, { fingerprint }) {
  const text = readFileSync(file, 'utf8')
  if (!text.startsWith('---\n')) die(`${file}: no front matter`)
  const end = text.indexOf('\n---', 4)
  if (end === -1) die(`${file}: unterminated front matter`)

  const head = text.slice(0, end)
  const tail = text.slice(end)
  if (!/^review:/m.test(head)) die(`${file}: no "review:" line to update`)

  // The body is everything after the closing fence -- the same span the
  // importers hash, or the two would never agree.
  const body = tail.replace(/^\n---[^\n]*\n/, '')
  const line = fingerprint ? `${value} (content ${contentFingerprint(body)})` : value

  writeFileSync(file, head.replace(/^review:.*$/m, `review: ${line}`) + tail)
}

// --- status -----------------------------------------------------------------

if (has('status') || process.argv.length === 2) {
  const modules = new Map()
  for (const root of [CONTENT, QUESTIONS]) {
    for (const course of courseDirs(root)) {
      for (const entry of readdirSync(course)) {
        const full = join(course, entry)
        if (!statSync(full).isDirectory()) continue
        const prefix = entry.slice(0, 2)
        if (!/^\d\d$/.test(prefix)) continue
        const kind = root === QUESTIONS ? 'questions' : 'lessons'
        const row = modules.get(prefix) ?? { name: entry, lessons: [], questions: [] }
        row.name = entry
        for (const file of markdownIn(full)) {
          row[kind].push(classifyReview(reviewLineOf(file)))
        }
        modules.set(prefix, row)
      }
    }
  }

  const summarise = (items) => {
    if (items.length === 0) return '—'
    const signed = items.filter((c) => c.reviewed)
    if (signed.length === 0) return `draft (${items.length})`
    if (signed.length === items.length) {
      return `REVIEWED by ${signed[0].reviewer} on ${signed[0].date}`
    }
    return `PARTIAL ${signed.length}/${items.length}`
  }

  console.log('Review status by module\n')
  for (const [prefix, row] of [...modules].sort()) {
    console.log(`  ${prefix} ${row.name}`)
    console.log(`       lessons:   ${summarise(row.lessons)}`)
    console.log(`       questions: ${summarise(row.questions)}`)
  }
  console.log('\nNothing reaches a student until its own file is signed off.')
  process.exit(0)
}

function reviewLineOf(file) {
  const text = readFileSync(file, 'utf8')
  const match = /^review:(.*)$/m.exec(text.slice(0, text.indexOf('\n---', 4) + 1))
  return match ? match[1].trim() : null
}

// --- sign off / undo --------------------------------------------------------

const prefix = arg('module')
if (!prefix) die('pass --module <two-digit prefix>, or --status')
if (!/^\d\d$/.test(prefix)) die(`--module must be a two-digit prefix, got "${prefix}"`)

const undo = has('undo')
const reviewer = arg('reviewer')
if (!undo && !reviewer) {
  die('pass --reviewer "<name>". Signing a module off is attributable on purpose.')
}
if (!undo && !reviewer.trim()) die('--reviewer cannot be blank')

const onlyQuestions = has('questions-only')
const onlyLessons = has('lessons-only')
if (onlyQuestions && onlyLessons) die('--questions-only and --lessons-only are exclusive')

let targets = moduleDirs(prefix)
if (targets.length === 0) die(`no module directory starts with "${prefix}-"`)
if (onlyQuestions) targets = targets.filter((t) => t.kind === 'questions')
if (onlyLessons) targets = targets.filter((t) => t.kind === 'lessons')
if (targets.length === 0) die('that filter left nothing to do')

const date = arg('date') ?? new Date().toISOString().slice(0, 10)
const value = undo
  ? 'UNREVIEWED — sign-off withdrawn, not yet checked by a licensed producer'
  : `REVIEWED by ${reviewer.trim()} on ${date}`

const check = classifyReview(value)
if (!undo && !check.reviewed) die(`refusing to write a line the gate rejects: ${check.problem}`)

let count = 0
for (const target of targets) {
  for (const file of markdownIn(target.dir)) {
    setReviewLine(file, value, { fingerprint: !undo })
    console.log(`  ${target.kind.padEnd(9)} ${file.slice(ROOT.length + 1)}`)
    count += 1
  }
}

console.log(`\n${undo ? 'Withdrew sign-off on' : 'Signed off'} ${count} file(s): ${value}`)
console.log('Run `node scripts/import-questions.mjs` to regenerate the seed.')
