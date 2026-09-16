import { describe, expect, it } from 'vitest'

// @ts-expect-error -- plain .mjs module shared with the importer scripts.
import { classifyReview } from '../scripts/review-gate.mjs'

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
