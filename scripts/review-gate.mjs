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

/** `REVIEWED by <name> on <YYYY-MM-DD>` -- name and date both required. */
const REVIEWED = /^REVIEWED by (.+?) on (\d{4}-\d{2}-\d{2})\b/

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
    const [, reviewer, date] = signed
    if (!isRealDate(date)) {
      return {
        reviewed: false,
        reviewer: null,
        date: null,
        problem: `review date "${date}" is not a real calendar date`,
      }
    }
    return { reviewed: true, reviewer: reviewer.trim(), date, problem: null }
  }

  if (UNREVIEWED.test(value)) {
    return { reviewed: false, reviewer: null, date: null, problem: null }
  }

  return {
    reviewed: false,
    reviewer: null,
    date: null,
    problem:
      `review line is neither a sign-off nor UNREVIEWED: ${JSON.stringify(value)}. ` +
      `Use "REVIEWED by <name> on <YYYY-MM-DD>" or start the line with UNREVIEWED.`,
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
