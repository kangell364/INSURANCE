#!/usr/bin/env node
/**
 * Verify every statute citation in the Texas lessons against the chapter text.
 *
 * WHY
 *
 * content/README.md requires the Texas sections to cite the statute, and the
 * citations are the part a reader cannot check without the source in front of
 * them. Drafting Chapter 462 I cited the net worth exclusion as §462.308; it
 * is §462.212, and §462.308 is a different provision entirely. Nothing would
 * have caught that except somebody reading the chapter again.
 *
 * So: pull every "§N.N" out of each lesson, work out which chapter file it
 * belongs to, and confirm the section actually exists there.
 *
 * A citation to a chapter that is not in reference/statutes/ is SKIPPED, not
 * failed -- roughly half the cited chapters have not been downloaded yet, and
 * failing on those would make the check useless until they all arrive.
 *
 * WHAT THIS DOES NOT CATCH
 *
 * It proves a cited section EXISTS. It cannot prove the lesson describes what
 * that section says. My §462.308 error would have passed this check, because
 * §462.308 is a real section -- just not the one about net worth. Citing the
 * wrong real section is the more likely mistake of the two, and only a reader
 * with the chapter open can catch it.
 *
 * `--headings` exists for that reader: it prints each citation next to the
 * statute's own section heading, so a mismatch between "net worth exclusion"
 * and "recovery from certain persons" is visible without opening the chapter.
 *
 *   node scripts/check-citations.mjs
 *   node scripts/check-citations.mjs --verbose     # list skipped chapters
 *   node scripts/check-citations.mjs --headings    # cite -> statute heading
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const STATUTES = join(ROOT, 'reference', 'statutes')
const TREES = [
  join(ROOT, 'content', 'texas-general-lines-property-casualty'),
  // Questions cite the statute in their explanations for exactly the same
  // reason lessons do, so they need exactly the same check.
  join(ROOT, 'content', 'questions', 'texas-general-lines-property-casualty'),
]
const VERBOSE = process.argv.includes('--verbose')
const HEADINGS = process.argv.includes('--headings')

/** `§462.213(b)` and `§4004.0535` -> chapter `462` / `4004`, section number. */
const CITATION = /§\s?(\d{2,4}[A-Z]?)\.(\d+(?:-\d+)?)/g

/**
 * A citation preceded by "TAC" is an Administrative Code RULE, not a statute.
 * They share the number space -- 28 TAC 21.115 and Insurance Code chapter 21
 * are unrelated -- so resolving a TAC rule against reference/statutes/ would
 * be meaningless. TAC rules live in reference/tac/ and are counted separately
 * rather than reported as "chapter not downloaded", which was the wrong
 * explanation for why they went unchecked.
 */
const TAC_BEFORE = /TAC\s*$/

/**
 * Sections a lesson cites BECAUSE they do not exist. The trade practices
 * lesson tells the student that the blueprint's own citation for rebating is
 * wrong -- Chapter 541 runs .051 to .055 and then jumps to .059 -- so the
 * citation failing to resolve is the point being taught, not an error.
 */
const DELIBERATE = new Map([
  ['541.056', 'repealed; the blueprint cites it for rebating, which is at 1806.104/.053/.153'],
])

const files = existsSync(STATUTES) ? readdirSync(STATUTES) : []
const cache = new Map()

/** Every held file whose name could hold this chapter (IN.401 vs LA.401). */
function sourcesFor(chapter) {
  return files.filter(
    (f) => f === `${f.slice(0, 2)}.${chapter}.txt` || f.startsWith(`${f.slice(0, 2)}.${chapter}-`),
  )
}

function textOf(file) {
  if (!cache.has(file)) cache.set(file, readFileSync(join(STATUTES, file), 'utf8'))
  return cache.get(file)
}

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e)
    if (readdirSync(dir, { withFileTypes: true }).find((d) => d.name === e)?.isDirectory()) {
      return walk(full)
    }
    return e.endsWith('.md') && /^\d\d-/.test(e) ? [full] : []
  })
}

/** The statute's own heading for a section, for eyeball review. */
function headingFor(sources, cite) {
  for (const source of sources) {
    const extracted = new RegExp(`Sec\\. ${cite}\\.\\s*([^\\n(]{0,90})`).exec(textOf(source))
    if (extracted) return extracted[1].trim().replace(/\s+/g, ' ')
    const summarised = new RegExp(`§${cite}\\b[^\\n]{0,90}`).exec(textOf(source))
    if (summarised) return summarised[0].trim().replace(/\s+/g, ' ')
  }
  return '(heading not found)'
}

const headings = []
const tac = new Set()
const bad = []
const skipped = new Map()
let checked = 0

for (const file of TREES.flatMap((t) => walk(t)).sort()) {
  const text = readFileSync(file, 'utf8')
  const relative = file.slice(ROOT.length + 1)
  const seen = new Set()

  for (const m of text.matchAll(CITATION)) {
    const [, chapter, section] = m
    const cite = `${chapter}.${section}`

    if (TAC_BEFORE.test(text.slice(Math.max(0, m.index - 12), m.index))) {
      tac.add(cite)
      continue
    }
    if (seen.has(cite)) continue
    seen.add(cite)

    const sources = sourcesFor(chapter)
    if (sources.length === 0) {
      skipped.set(chapter, (skipped.get(chapter) ?? 0) + 1)
      continue
    }

    if (DELIBERATE.has(cite)) continue

    checked += 1
    // Extracted chapters print headings as "Sec. 462.213."; the hand-written
    // key-provisions summaries use "**§2210.001**". Accept either, and anchor
    // both so 462.21 cannot pass by being a prefix of 462.213.
    const found = sources.some((s) => {
      const text = textOf(s)
      return text.includes(`Sec. ${cite}.`) || new RegExp(`§${cite}\\b`).test(text)
    })
    if (!found) bad.push({ relative, cite, sources })
    else if (HEADINGS) headings.push({ relative, cite, heading: headingFor(sources, cite) })
  }
}

console.log(`${checked} citation(s) checked against ${files.length} statute file(s).`)
if (tac.size > 0) {
  console.log(
    `${tac.size} TAC rule(s) cited and not checked here (they are rules, not ` +
      `statutes, and live in reference/tac/): ${[...tac].sort().join(', ')}`,
  )
}

if (skipped.size > 0) {
  const total = [...skipped.values()].reduce((a, b) => a + b, 0)
  console.log(
    `${total} citation(s) skipped -- chapter not downloaded: ${[...skipped.keys()].sort().join(', ')}`,
  )
  if (VERBOSE) for (const [ch, n] of [...skipped].sort()) console.log(`    ${ch}: ${n}`)
}

if (bad.length > 0) {
  console.error('\nCitations naming a section that does not exist in the chapter:')
  for (const b of bad) console.error(`  - ${b.relative}: §${b.cite} (checked ${b.sources.join(', ')})`)
  process.exit(1)
}

if (HEADINGS) {
  let current = null
  for (const h of headings) {
    if (h.relative !== current) {
      console.log(`\n${h.relative}`)
      current = h.relative
    }
    console.log(`  §${h.cite.padEnd(10)} ${h.heading}`)
  }
  console.log()
}

console.log('Every checkable citation resolves to a real section.')
console.log('NOTE: this proves the section exists, not that the lesson describes it')
console.log('correctly. Use --headings to eyeball that, or read the chapter.')
