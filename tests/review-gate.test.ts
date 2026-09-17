import { describe, expect, it } from 'vitest'

// Plain .mjs, shared with the importer scripts so the gate cannot drift.
import {
  classifyReview,
  contentFingerprint,
  verifyFingerprint,
} from '../scripts/review-gate.mjs'

/**
 * The review gate decides whether a lesson or a question reaches a student.
 *
 * It was once a denylist -- publish unless the line contains "UNREVIEWED" --
 * and every near-miss in `nearMisses` below published to students. These
 * assertions exist so that it cannot become a denylist again.
 */
describe('classifyReview', () => {
  const nearMisses = [
    'not yet reviewed',
    'unreviewed',
    'UNREVIEWD — typo',
    'pending review by a producer',
    'Unreviewed',
    'to be reviewed',
    'reviewed?',
    'REVIEWED',
    'REVIEWED by Duane Angell',
    'REVIEWED on 2026-09-16',
    'REVIEWED by Duane Angell on 16-09-2026',
  ]

  it.each(nearMisses)('holds %j as draft rather than publishing it', (line) => {
    expect(classifyReview(line).reviewed).toBe(false)
  })

  it.each(nearMisses)('reports %j as a problem rather than failing quietly', (line) => {
    // A silent hold would cost a reviewer a module and no one would know why.
    expect(classifyReview(line).problem).toBeTruthy()
  })

  it('publishes an explicit sign-off naming the reviewer and the date', () => {
    const result = classifyReview('REVIEWED by Duane Angell on 2026-09-16')
    expect(result.reviewed).toBe(true)
    expect(result.reviewer).toBe('Duane Angell')
    expect(result.date).toBe('2026-09-16')
    expect(result.problem).toBeNull()
  })

  it('accepts trailing notes after the date', () => {
    const result = classifyReview(
      'REVIEWED by Duane Angell on 2026-09-16 — fixed two distractors',
    )
    expect(result.reviewed).toBe(true)
    expect(result.reviewer).toBe('Duane Angell')
  })

  it('treats an explicit UNREVIEWED as a deliberate draft, not a problem', () => {
    const result = classifyReview('UNREVIEWED — drafted by Claude, not yet checked')
    expect(result.reviewed).toBe(false)
    expect(result.problem).toBeNull()
  })

  it('rejects a date that is not a real calendar day', () => {
    // The regex alone would accept 2026-02-30; the calendar check must not.
    const result = classifyReview('REVIEWED by Duane Angell on 2026-02-30')
    expect(result.reviewed).toBe(false)
    expect(result.problem).toMatch(/not a real calendar date/)
  })

  it('accepts a leap day in a leap year', () => {
    expect(classifyReview('REVIEWED by A Reviewer on 2028-02-29').reviewed).toBe(true)
  })

  it('rejects a leap day in a non-leap year', () => {
    expect(classifyReview('REVIEWED by A Reviewer on 2027-02-29').reviewed).toBe(false)
  })

  it('requires a named reviewer, so sign-off is attributable', () => {
    expect(classifyReview('REVIEWED by  on 2026-09-16').reviewed).toBe(false)
  })

  it('holds a missing or empty review line as draft', () => {
    expect(classifyReview(undefined).reviewed).toBe(false)
    expect(classifyReview('').reviewed).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(classifyReview('  REVIEWED by Duane Angell on 2026-09-16  ').reviewed).toBe(
      true,
    )
  })
})

/* ==========================================================================
   A sign-off covers the words that existed when it was made.

   Without a fingerprint the gate read a line and nothing else, so a lesson
   signed off in March and edited in April still published as reviewed. The
   reviewer's name sat on text they had never seen — which in a licensing
   context is not a stale artifact but somebody attesting to content that did
   not exist when they attested.

   The worst version is a question: a changed ANSWER KEY under an unchanged
   sign-off is precisely what this gate exists to prevent.
   ========================================================================== */

describe('content fingerprint', () => {
  const SIGNED = 'REVIEWED by Duane Angell on 2026-09-17'

  it('parses a hash out of the review line', () => {
    const c = classifyReview(`${SIGNED} (content abc123def456)`)
    expect(c.reviewed).toBe(true)
    expect(c.contentHash).toBe('abc123def456')
  })

  it('accepts a sign-off that carries no hash, and says so', () => {
    const c = classifyReview(SIGNED)
    const v = verifyFingerprint(c, 'any body at all')
    expect(v.ok).toBe(true)
    expect(v.reason).toMatch(/without a content hash/)
  })

  it('holds a file whose body changed after sign-off', () => {
    const body = 'The peril is the cause of loss.'
    const c = classifyReview(`${SIGNED} (content ${contentFingerprint(body)})`)

    expect(verifyFingerprint(c, body).ok).toBe(true)

    const edited = 'The peril is the cause of loss. And something new.'
    const after = verifyFingerprint(c, edited)
    expect(after.ok).toBe(false)
    expect(after.reason).toMatch(/content changed since Duane Angell/)
  })

  it('survives reflowing, because whitespace is not a change of meaning', () => {
    const original = 'A hostile fire burns where it is not meant to.'
    const reflowed = 'A hostile fire burns\n  where it is not meant to.'
    expect(contentFingerprint(original)).toBe(contentFingerprint(reflowed))
  })

  it('does not survive a changed answer, which is the point', () => {
    const before = '- [x] Physical hazard\n- [ ] Moral hazard'
    const after = '- [ ] Physical hazard\n- [x] Moral hazard'
    expect(contentFingerprint(before)).not.toBe(contentFingerprint(after))
  })
})
