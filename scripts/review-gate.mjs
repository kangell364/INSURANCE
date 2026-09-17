import { createHash } from 'node:crypto'

/**
 * The review gate, shared by the lesson and question importers.
 *
 * WHY THIS IS AN ALLOWLIST
 *
 * The gate used to ask `!review.includes('UNREVIEWED')` -- publish unless the
 * line says UNREVIEWED. That is a denylist, and it fails in the dangerous
 * direction. Every one of these published to students:
 *
 *     review: not yet reviewed
 *     review: unreviewed
 *     review: UNREVIEWD -- typo
 *     review: pending review by a producer
 *
 * A reviewer editing that line by hand is exactly the moment a near-miss gets
 * written, and the consequence is the one this project keeps coming back to:
 * a wrong answer key marks a correct answer WRONG, and the student believes
 * the material over themselves.
 *
 * So publication now requires an affirmative marker naming WHO signed it off
 * and WHEN. Anything else is a draft. A line that is neither a valid sign-off
 * nor an explicit UNREVIEWED is reported as a problem rather than silently
 * held, so a typo is visible in CI instead of quietly costing you a module.
 */

/**
 * `REVIEWED by <name> on <YYYY-MM-DD> (content <hash>)`.
 *
 * WHY THE HASH IS THERE
 *
 * Without it the gate reads a line and nothing else, so a file signed off in
 * March and edited in April still published as reviewed. The reviewer's name
 * would sit on top of text they never saw -- and in a licensing context that
 * is not a stale artifact, it is somebody attesting to content that did not
 * exist when they attested.
 *
 * The hash is of the lesson BODY, so the sign-off survives front-matter
 * housekeeping (a corrected estimated_minutes, a changed slug) and does not
 * survive a changed sentence.
 *
 * The group is optional because a line written by hand may omit it. A
 * sign-off with no hash is honoured, and reported, so the gap is visible
 * rather than silent -- the same treatment an ambiguous line gets.
 */
const REVIEWED =
  /^REVIEWED by (.+?) on (\d{4}-\d{2}-\d{2})(?:\s*\(content ([0-9a-f]{8,64})\))?/

/** An explicit, deliberate "not yet". */
const UNREVIEWED = /^UNREVIEWED\b/

/**
 * Classify a `review:` front-matter line.
 *
 * Returns `{ reviewed, reviewer, date, problem }`. `problem` is a string when
 * the line is ambiguous -- neither a valid sign-off nor an explicit
 * UNREVIEWED -- and null otherwise. An ambiguous line is never published.
 */
export function classifyReview(line) {
  const value = (line ?? '').trim()

  const signed = REVIEWED.exec(value)
  if (signed) {
    const [, reviewer, date, hash] = signed
    if (!isRealDate(date)) {
      return {
        reviewed: false,
        reviewer: null,
        date: null,
        contentHash: null,
        problem: `review date "${date}" is not a real calendar date`,
      }
    }
    return {
      reviewed: true,
      reviewer: reviewer.trim(),
      date,
      contentHash: hash ?? null,
      problem: null,
    }
  }

  if (UNREVIEWED.test(value)) {
    return {
      reviewed: false,
      reviewer: null,
      date: null,
      contentHash: null,
      problem: null,
    }
  }

  return {
    reviewed: false,
    reviewer: null,
    date: null,
    contentHash: null,
    problem:
      `review line is neither a sign-off nor UNREVIEWED: ${JSON.stringify(value)}. ` +
      `Use "REVIEWED by <name> on <YYYY-MM-DD>" or start the line with UNREVIEWED.`,
  }
}

/**
 * The fingerprint a sign-off is taken against: the file BELOW its front
 * matter, whitespace-normalised.
 *
 * Front matter is excluded on purpose. Correcting estimated_minutes or fixing
 * a summary should not invalidate a reviewer's reading of the lesson, and a
 * sign-off that breaks on housekeeping is one people learn to re-apply without
 * looking -- which is the failure this whole gate exists to prevent.
 *
 * Whitespace is normalised so reflowing a paragraph does not count as a
 * change. Anything that alters a WORD does.
 */
export function contentFingerprint(body) {
  const normalised = body.replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalised).digest('hex').slice(0, 12)
}

/**
 * Decide whether a signed-off file still matches what was signed.
 *
 * Returns `{ ok, reason }`. A sign-off carrying no hash is `ok` with a reason,
 * because hand-written lines predate this and refusing them would strand
 * existing work -- but the reason is reported so the gap is visible.
 */
export function verifyFingerprint(classified, body) {
  if (!classified.reviewed) return { ok: false, reason: null }
  if (!classified.contentHash) {
    return { ok: true, reason: 'signed off without a content hash' }
  }
  const actual = contentFingerprint(body)
  if (actual === classified.contentHash) return { ok: true, reason: null }
  return {
    ok: false,
    reason:
      `content changed since ${classified.reviewer} signed it off on ` +
      `${classified.date} (signed ${classified.contentHash}, now ${actual})`,
  }
}

/** Rejects 2026-02-30 and friends, which the regex alone would accept. */
function isRealDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  )
}
