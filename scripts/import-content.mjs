#!/usr/bin/env node
/**
 * Turn the Markdown lessons in content/ into loadable SQL.
 *
 * THE RULE THIS SCRIPT EXISTS TO ENFORCE:
 *
 *   A lesson whose front matter still says UNREVIEWED is written out as a
 *   DRAFT, whatever its `status` field claims. Draft lessons are invisible to
 *   students — body included — because of the RLS policies in
 *   supabase/migrations/20260201000500_content_rls.sql.
 *
 * This is a rule rather than a convention on purpose. The drafts are written
 * against the published blueprint and read fluently and confidently whether
 * or not they are correct, which is exactly what makes an error in one hard
 * to notice. "Remember to check the review line before publishing" is the
 * kind of safeguard that works until the day somebody is in a hurry.
 *
 *   node scripts/import-content.mjs            # writes supabase/seed_content.sql
 *   node scripts/import-content.mjs --check    # report only, write nothing
 *
 * Exits non-zero if any lesson is malformed, so it can gate CI.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const CONTENT = join(ROOT, 'content')
const OUT = join(ROOT, 'supabase', 'seed_content.sql')
const CHECK_ONLY = process.argv.includes('--check')

const REVIEWED_MARKER = 'UNREVIEWED'

/** A stable uuid derived from a string, so re-running produces the same ids. */
function uuidFor(kind, key) {
  const hash = createHash('sha1').update(`${kind}:${key}`).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    // Version 5 nibble, so the value is a well-formed uuid rather than
    // 32 arbitrary hex characters that happen to fit.
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

/** Splits `---` front matter from the body. Returns null when absent. */
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

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.md') && !basename(full).startsWith('README') &&
      basename(full) !== 'COURSE-MAP.md'
      ? [full]
      : []
  })
}

const problems = []
const lessons = []
const modules = new Map()

for (const file of walk(CONTENT).sort()) {
  const relative = file.slice(CONTENT.length + 1)
  const parts = relative.split('/')
  if (parts.length < 3) continue

  const [courseSlug, moduleDir] = parts
  const parsed = parseFrontMatter(readFileSync(file, 'utf8'))
  if (!parsed) {
    problems.push(`${relative}: no front matter`)
    continue
  }

  const { meta, body } = parsed
  for (const required of ['module', 'title', 'slug', 'review']) {
    if (!meta[required]) problems.push(`${relative}: missing "${required}"`)
  }
  if (!body) problems.push(`${relative}: empty body`)
  if (problems.length) continue

  const modulePosition = Number.parseInt(moduleDir.slice(0, 2), 10)
  if (!Number.isInteger(modulePosition)) {
    problems.push(`${relative}: directory must start with a two-digit order`)
    continue
  }

  const moduleKey = `${courseSlug}/${moduleDir}`
  if (!modules.has(moduleKey)) {
    modules.set(moduleKey, {
      id: uuidFor('module', moduleKey),
      courseSlug,
      title: meta.module,
      position: modulePosition,
    })
  }

  const reviewed = !meta.review.includes(REVIEWED_MARKER)
  lessons.push({
    id: uuidFor('lesson', `${courseSlug}/${meta.slug}`),
    moduleKey,
    courseSlug,
    title: meta.title,
    slug: meta.slug,
    summary: meta.summary ?? null,
    minutes: meta.estimated_minutes ? Number(meta.estimated_minutes) : null,
    blueprint: meta.blueprint ?? null,
    // The enforcement. `status: active` in the front matter is a request, not
    // a decision; an unreviewed lesson is written out as a draft regardless.
    status: reviewed && meta.status === 'active' ? 'active' : 'draft',
    reviewed,
    body,
    position: lessons.filter((l) => l.moduleKey === moduleKey).length + 1,
    file: relative,
  })
}

if (problems.length) {
  console.error('Content problems:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}

const unreviewed = lessons.filter((l) => !l.reviewed)
console.log(`${lessons.length} lesson(s) across ${modules.size} module(s)`)
console.log(`  reviewed and publishable: ${lessons.length - unreviewed.length}`)
console.log(`  held as draft (UNREVIEWED): ${unreviewed.length}`)
for (const l of unreviewed) console.log(`    · ${l.file}`)

if (CHECK_ONLY) process.exit(0)

const out = []
out.push('-- GENERATED by scripts/import-content.mjs — do not edit by hand.')
out.push('-- Source of truth is content/. Re-run the script after editing a lesson.')
out.push('--')
out.push('-- Lessons whose front matter still says UNREVIEWED are written as')
out.push('-- drafts, which RLS hides from students entirely, body included.')
out.push('')

for (const m of modules.values()) {
  out.push(`insert into public.modules (id, course_id, title, position, status)`)
  out.push(`select ${sql(m.id)}, c.id, ${sql(m.title)}, ${m.position}, 'active'`)
  out.push(`  from public.courses c where c.slug = ${sql(m.courseSlug)}`)
  out.push(`on conflict (id) do update set title = excluded.title;`)
  out.push('')
}

for (const l of lessons) {
  const m = modules.get(l.moduleKey)
  out.push(`insert into public.lessons`)
  out.push(`  (id, module_id, course_id, title, slug, summary, position, status,`)
  out.push(`   estimated_minutes)`)
  out.push(`select ${sql(l.id)}, ${sql(m.id)}, c.id, ${sql(l.title)},`)
  out.push(`       ${sql(l.slug)}, ${sql(l.summary)}, ${l.position},`)
  out.push(`       ${sql(l.status)}, ${sql(l.minutes)}`)
  out.push(`  from public.courses c where c.slug = ${sql(l.courseSlug)}`)
  out.push(`on conflict (id) do update set`)
  out.push(`  title = excluded.title, summary = excluded.summary,`)
  out.push(`  position = excluded.position, status = excluded.status,`)
  out.push(`  estimated_minutes = excluded.estimated_minutes;`)
  out.push('')
  out.push(`insert into public.lesson_contents (lesson_id, course_id, body)`)
  out.push(`select ${sql(l.id)}, c.id, $lesson$${l.body}$lesson$`)
  out.push(`  from public.courses c where c.slug = ${sql(l.courseSlug)}`)
  out.push(`on conflict (lesson_id) do update set body = excluded.body;`)
  out.push('')
  if (l.blueprint) {
    out.push(`insert into public.lesson_topics (lesson_id, topic_id, course_id)`)
    out.push(`select ${sql(l.id)}, t.id, t.course_id`)
    out.push(`  from public.topics t`)
    out.push(`  join public.courses c on c.id = t.course_id`)
    out.push(` where c.slug = ${sql(l.courseSlug)} and t.code = ${sql(l.blueprint)}`)
    out.push(`on conflict (lesson_id, topic_id) do nothing;`)
    out.push('')
  }
}

writeFileSync(OUT, out.join('\n'))
console.log(`\nwrote ${OUT.slice(ROOT.length + 1)} (${out.length} lines)`)
