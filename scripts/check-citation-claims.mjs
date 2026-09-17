#!/usr/bin/env node
/**
 * Check what a lesson SAYS about a statute against what the statute says.
 *
 * WHY
 *
 * check-citations.mjs proves a cited section exists. It cannot prove the
 * lesson describes it correctly, and it says so in its own output. That gap
 * is not theoretical: two lessons in this course stated that the 30/60/25
 * financial-responsibility floor reaches PIP, citing Sec. 1952.105. Sec.
 * 1952.105 is Subchapter C -- uninsured and underinsured motorist coverage --
 * and never uses the phrase "personal injury protection" at all. PIP is
 * Subchapter D, capped at $2,500 by Sec. 1952.153. The citation resolved, the
 * existing check passed, and the course taught Texas law incorrectly.
 *
 * Citing the wrong REAL section is the more likely error of the two, and it is
 * the one a student cannot catch, because a confident wrong sentence about
 * insurance law reads exactly like a correct one.
 *
 * WHAT IT DOES
 *
 * For each citation, take the sentence it sits in -- the claim -- and hold it
 * against the text of the cited section:
 *
 *   NUMBERS   A dollar amount, day count, or percentage asserted in the claim
 *             should appear in the section being cited. "$2,500 (Sec.
 *             1952.153)" is checkable; "$2,500 (Sec. 1952.105)" is wrong.
 *
 *   SUBJECTS  A distinctive subject term in the claim should appear in the
 *             section being cited. This is the rule that catches the PIP
 *             error, and the reason the term list below is deliberately short:
 *             every entry is a term where citing the neighbouring section
 *             changes the right answer on an exam.
 *
 * A claim may cite several sections; the text of all of them counts, because
 * "the 30/60/25 floor in Chapter 601 also governs Sec. 1952.105 offers" is one
 * sentence drawing on two sources.
 *
 * WHAT IT DOES NOT CATCH
 *
 * Paraphrase. A lesson may state a rule correctly in words the statute never
 * uses, and this check cannot tell that from an error -- which is why a flag
 * is a question for a human, not a verdict, and why ACCEPTED below requires a
 * written reason rather than a bare suppression.
 *
 * It also only sees downloaded chapters. Citations to chapters not in
 * reference/statutes/ are skipped, exactly as the existing check skips them.
 *
 *   node scripts/check-citation-claims.mjs
 *   node scripts/check-citation-claims.mjs --verbose  # show the claim text
 *   node scripts/check-citation-claims.mjs --max 12   # ratchet ceiling
 *   node scripts/check-citation-claims.mjs --strict   # exit 1 on any flag
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const STATUTES = join(ROOT, 'reference', 'statutes')
const TREES = [
  join(ROOT, 'content', 'texas-general-lines-property-casualty'),
  join(ROOT, 'content', 'questions', 'texas-general-lines-property-casualty'),
]

const VERBOSE = process.argv.includes('--verbose')
const STRICT = process.argv.includes('--strict')
const MAX = (() => {
  const i = process.argv.indexOf('--max')
  return i === -1 ? null : Number(process.argv[i + 1])
})()

const CITATION = /§\s?(\d{2,4}[A-Z]?)\.(\d+(?:-\d+)?)/g
const TAC_BEFORE = /TAC\s*$/

/**
 * Subject terms where citing the section next door changes the exam answer.
 *
 * Kept short on purpose. A long list produces noise, and a check whose output
 * nobody reads is worse than no check, because it looks like coverage.
 *
 * A term only belongs here if the STATUTE can actually say it. "Twisting" was
 * an entry until it flagged five correct lessons: §4005.101(b)(7) describes
 * twisting precisely -- incomplete comparisons made to induce a policyholder
 * to surrender and replace -- but the word "twisting" appears nowhere in the
 * Insurance Code, because it is the industry's name for the conduct and the
 * exam's, not the legislature's. A rule that can never be satisfied reports
 * every correct lesson as suspect, which trains the reader to skim the output.
 *
 * Each entry is [canonical term, /pattern in a lesson/, /pattern in statute/].
 * The two patterns differ because a lesson writes "PIP" and the Insurance Code
 * writes "personal injury protection coverage".
 */
const SUBJECTS = [
  ['personal injury protection', /\bPIP\b|personal injury protection/i, /personal injury protection/i],
  ['uninsured motorist', /\buninsured motorist|\bUM\b/i, /uninsured (?:or underinsured )?motor/i],
  ['underinsured motorist', /\bunderinsured motorist|\bUIM\b/i, /underinsured motor|uninsured or underinsured/i],
  ['cancellation', /\bcancel(?:s|led|lation|ling)?\b/i, /cancel/i],
  ['nonrenewal', /\bnonrenew(?:al|ed|s)?\b|\bnon-renew/i, /nonrenew|refus\w+ to renew/i],
  ['replacement cost', /replacement cost/i, /replacement cost/i],
  ['actual cash value', /actual cash value|\bACV\b/i, /actual cash value/i],
  ['coinsurance', /\bcoinsurance\b/i, /coinsurance/i],
  ['subrogation', /\bsubrogat/i, /subrogat/i],
  ['appraisal', /\bappraisal\b/i, /apprais/i],
  ['rebating', /\brebat(?:e|es|ing)\b/i, /rebat/i],
  ['surplus lines', /surplus lines/i, /surplus lines/i],
  ['certificate of authority', /certificate of authority/i, /certificate of authority/i],
  ['guaranty association', /guaranty association/i, /guaranty association/i],
  ['windstorm', /\bwindstorm\b/i, /windstorm/i],
  ['workers compensation', /workers compensation/i, /workers compensation/i],
]

/**
 * Flags a human has read and accepted, each with the reason it is not an
 * error. A bare suppression is not allowed: the reason is the record of
 * somebody having actually opened the chapter.
 */
const ACCEPTED = new Map([
  // e.g. ['05-texas-statutes-and-rules/03-x.md|1952.153|$2,500',
  //       'statute writes the figure as "2,500"; the dollar sign is ours'],
])

/**
 * Split a chapter file into sections: "Sec. 1952.105. HEADING. body..."
 *
 * Each section carries its SUBCHAPTER heading, because the Insurance Code
 * leans on it constantly: Sec. 1952.155 says "coverage required by this
 * subchapter" and never the words "personal injury protection", which live in
 * the heading of Subchapter D above it. Without the heading, every such
 * section looks like it is about nothing.
 *
 * This does not blunt the check. Sec. 1952.105 sits under Subchapter C,
 * "UNINSURED OR UNDERINSURED MOTORIST COVERAGE", so a lesson claiming PIP
 * while citing it still finds no "personal injury protection" anywhere in
 * section or heading -- which is the original error this check exists for.
 */
export function sectionsOf(text) {
  const out = new Map()
  const subchapters = [...text.matchAll(/^SUBCHAPTER [A-Z]+\..*$/gm)]
  const headingAt = (index) => {
    let heading = ''
    for (const s of subchapters) {
      if (s.index < index) heading = s[0]
      else break
    }
    return heading
  }
  const marks = [...text.matchAll(/^Sec\. (\d{2,4}[A-Z]?\.\d+(?:-\d+)?)\./gm)]
  marks.forEach((m, i) => {
    // A section ends at the next section OR at the next subchapter heading,
    // whichever comes first. Running to the next section alone swallowed the
    // heading in between, so the last section of Subchapter C inherited
    // Subchapter D's subject -- which is precisely how a PIP claim hung on
    // §1952.105 could have passed this check unnoticed.
    const nextSection = i + 1 < marks.length ? marks[i + 1].index : text.length
    const nextSubchapter = subchapters.find((s) => s.index > m.index)?.index ?? text.length
    out.set(m[1], headingAt(m.index) + '\n' + text.slice(m.index, Math.min(nextSection, nextSubchapter)))
  })
  // The hand-written key-provisions summaries use "**§2210.001** ..." instead.
  for (const m of text.matchAll(/§(\d{2,4}[A-Z]?\.\d+(?:-\d+)?)\*{0,2}([^\n]*)/g)) {
    if (!out.has(m[1])) out.set(m[1], m[0])
  }
  return out
}

/**
 * The chapter text as extracted from the state's PDFs, tidied enough to match
 * against. The extractor puts spaces around apostrophes -- "workers '
 * compensation" appears 142 times across reference/statutes/, "workers'
 * compensation" once -- and breaks lines mid-phrase. Both are artefacts of the
 * PDF, not of the law, and matching against them unnormalised produced flags
 * that said a chapter never mentions its own subject.
 *
 * Apostrophes come out on BOTH sides rather than being repaired, because
 * repairing them is ambiguous -- "workers ' compensation" wants the space
 * kept and "insured ' s policy" wants it closed, and guessing wrong silently
 * breaks matching again. Lesson claims go through the same function so the
 * two sides are always compared on the same footing.
 */
export function normalise(text) {
  return text.replace(/['\u2019]/g, '').replace(/\s+/g, ' ')
}

const files = existsSync(STATUTES) ? readdirSync(STATUTES) : []
const cache = new Map()

function sectionsForChapter(chapter) {
  if (!cache.has(chapter)) {
    const merged = new Map()
    for (const f of files) {
      if (f === `${f.slice(0, 2)}.${chapter}.txt` || f.startsWith(`${f.slice(0, 2)}.${chapter}-`)) {
        for (const [k, v] of sectionsOf(readFileSync(join(STATUTES, f), 'utf8'))) {
          merged.set(k, (merged.get(k) ?? '') + '\n' + v)
        }
      }
    }
    cache.set(chapter, merged)
  }
  return cache.get(chapter)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name)
    if (e.isDirectory()) return walk(full)
    return e.name.endsWith('.md') && /^\d\d-/.test(e.name) ? [full] : []
  })
}

/**
 * The claims in a file, each with the offsets it spans.
 *
 * A claim is one sentence, but "one sentence" is not "one line": lessons are
 * hard-wrapped, so a claim routinely spans several lines. An earlier version
 * of this treated every newline as a boundary and split
 *
 *   7. **$30,000** -- §601.003 treats the judgment as satisfied for this purpose
 *      once the amount required by §601.072(a-1)(1) ...
 *
 * in half, then reported the $30,000 as unsupported because it could no longer
 * see the §601.072 citation that supports it. The check was manufacturing its
 * own false positives out of line breaks.
 *
 * So: paragraph breaks, list-item starts, headings, and block quotes end a
 * claim; a wrapped newline inside one does not. Periods inside a citation are
 * safe because a sentence split needs whitespace after the period, and
 * "§601.072" has none.
 */
export function claimsOf(text) {
  const blocks = []
  let at = 0
  const BOUNDARY = /\n\s*\n|\n(?=\s*(?:[-*+]\s|\d+\.\s|#{1,6}\s|>\s|\|))/g
  for (const m of text.matchAll(BOUNDARY)) {
    blocks.push([at, m.index])
    at = m.index + m[0].length
  }
  blocks.push([at, text.length])

  const claims = []
  for (const [bStart, bEnd] of blocks) {
    const block = text.slice(bStart, bEnd)
    let from = 0
    for (const m of block.matchAll(/(?<=[.!?])\s+/g)) {
      claims.push([bStart + from, bStart + m.index + 1])
      from = m.index + m[0].length
    }
    if (from < block.length) claims.push([bStart + from, bEnd])
  }
  return claims.filter(([a, b]) => b > a)
}

/** Digit strings that carry meaning: money, durations, percentages. */
export function numbersIn(claim) {
  const out = new Set()
  for (const m of claim.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)) out.add(`$${m[1]}`)
  for (const m of claim.matchAll(/\b(\d[\d,]*)\s+(day|hour|month|year)s?\b/gi)) {
    out.add(`${m[1]} ${m[2].toLowerCase()}s`)
  }
  for (const m of claim.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s?%/g)) out.add(`${m[1]}%`)
  return out
}

/** "$2,500" and the statute's "2,500" are the same figure. */
function digitsOf(token) {
  return token.replace(/[^\d]/g, '')
}

export function statuteHasNumber(token, body) {
  const digits = digitsOf(token)
  if (digits === '') return true
  // Match the digit run with optional comma grouping, not as part of a longer
  // number: 30 must not be satisfied by 300 or by 1930.
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',?')
  return new RegExp(`(?<![\\d,])${grouped}(?![\\d])`).test(body)
}

/**
 * Judge one claim against the text of every section it cites.
 *
 * Exported so the case this check exists for can be tested directly rather
 * than inferred from a whole-course run: a lesson asserting PIP while citing
 * §1952.105 must flag, and a lesson asserting PIP while citing §1952.153 must
 * not. Everything above is plumbing; this is the judgement.
 */
export function judgeClaim(claim, sectionText) {
  const flat = normalise(claim)
  const body = normalise(sectionText)
  const out = []
  for (const token of numbersIn(flat)) {
    if (!statuteHasNumber(token, body)) out.push({ kind: 'number', what: token })
  }
  for (const [term, inLesson, inStatute] of SUBJECTS) {
    if (inLesson.test(flat) && !inStatute.test(body)) out.push({ kind: 'subject', what: term })
  }
  return out
}

/** Walk the course and report. Skipped when this file is imported by a test. */
function main() {
  const flags = []
  const skipped = new Set()
  let claimsChecked = 0

  for (const file of TREES.filter(existsSync).flatMap(walk).sort()) {
    const text = readFileSync(file, 'utf8')
    const relative = file.slice(join(ROOT, 'content').length + 1)

    // A sentence citing two sections is judged against both, because "the floor
    // in §601.072 is what §601.003 credits" draws on each of them.
    const claims = new Map()
    for (const [from, to] of claimsOf(text)) {
      const slice = text.slice(from, to)
      const cites = new Set()
      for (const m of slice.matchAll(CITATION)) {
        const abs = from + m.index
        if (TAC_BEFORE.test(text.slice(Math.max(0, abs - 12), abs))) continue
        cites.add(`${m[1]}.${m[2]}`)
      }
      if (cites.size > 0) claims.set(slice.trim(), cites)
    }

    for (const [claim, cites] of claims) {
      let body = ''
      let resolved = 0
      for (const cite of cites) {
        const chapter = cite.slice(0, cite.indexOf('.'))
        const section = sectionsForChapter(chapter).get(cite)
        if (section === undefined) {
          skipped.add(chapter)
          continue
        }
        resolved += 1
        body += ' ' + normalise(section)
      }
      if (resolved === 0) continue
      claimsChecked += 1

      const cited = [...cites].join(', ')
      const key = (what) => `${relative}|${cited}|${what}`

      for (const { kind, what } of judgeClaim(claim, body)) {
        if (ACCEPTED.has(key(what))) continue
        flags.push({ relative, cited, kind, what, claim })
      }
    }
  }

  console.log(`${claimsChecked} claim(s) checked against the cited statute text.`)
  if (skipped.size > 0) {
    console.log(`chapter(s) not downloaded, so not checkable here: ${[...skipped].sort().join(', ')}`)
  }

  if (flags.length > 0) {
    console.log(`\n${flags.length} claim(s) assert something the cited section does not contain:\n`)
    let current = null
    for (const f of flags) {
      if (f.relative !== current) {
        console.log(`  ${f.relative}`)
        current = f.relative
      }
      console.log(`    §${f.cited}  ${f.kind}: ${f.what} appears nowhere in the cited section`)
      if (VERBOSE) console.log(`      claim: ${f.claim.replace(/\s+/g, ' ').slice(0, 200)}`)
    }
    console.log(`
  A flag is a question, not a verdict: the lesson may be paraphrasing correctly.
  Open the chapter. If the lesson is right, add the key to ACCEPTED in this
  script WITH THE REASON. If it is wrong, fix the lesson -- that is the error
  this check exists to find.

  Re-run with --verbose to see the sentence each flag came from.`)
  }

  if (STRICT && flags.length > 0) process.exit(1)
  if (MAX !== null) {
    if (flags.length > MAX) {
      console.error(`\n${flags.length} flag(s), ceiling is ${MAX}. Fix one or accept it with a reason.`)
      process.exit(1)
    }
    if (flags.length < MAX) {
      console.log(`\nBelow the ceiling of ${MAX}. Lower it to ${flags.length} in .github/workflows/ci.yml so the ground gained is held.`)
    }
  }

}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (invoked) main()
