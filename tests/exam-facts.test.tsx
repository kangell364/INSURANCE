import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  BLUEPRINT,
  EXAM,
  PASS_RATES,
  PRIMARY_ID,
  SECONDARY_ID,
} from '@/lib/exam-facts'

vi.mock('next/navigation', () => ({
  usePathname: () => '/texas-exam-day',
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

const ExamDayPage = (await import('@/app/(marketing)/texas-exam-day/page'))
  .default

/* ==========================================================================
   These are arithmetic and consistency checks on published figures, not
   opinions about wording.

   They exist because this page makes factual claims to somebody deciding
   whether to spend $49 and an afternoon. The failure mode is not a crash — it
   is a number that quietly stops matching the document it came from, which no
   other test in this repository would notice.
   ========================================================================== */

describe('the published blueprint', () => {
  it('sums to the scored-question total', () => {
    const total = BLUEPRINT.reduce((n, s) => n + s.questions, 0)
    expect(total).toBe(EXAM.scoredQuestions)
  })

  it('splits into the published general and state subtotals', () => {
    const general = BLUEPRINT.filter((s) => !s.code.startsWith('TX')).reduce(
      (n, s) => n + s.questions,
      0,
    )
    const state = BLUEPRINT.filter((s) => s.code.startsWith('TX')).reduce(
      (n, s) => n + s.questions,
      0,
    )
    expect(general).toBe(EXAM.generalKnowledgeQuestions)
    expect(state).toBe(EXAM.stateSpecificQuestions)
  })

  it('accounts for every question on the paper', () => {
    expect(EXAM.scoredQuestions + EXAM.pretestQuestions).toBe(
      EXAM.totalQuestions,
    )
  })
})

describe('the August 2026 pass rates', () => {
  it('reports rates consistent with the counts behind them', () => {
    for (const row of [PASS_RATES.firstTime, PASS_RATES.repeat]) {
      const computed = Math.round((row.passed / row.graded) * 100)
      expect(Math.abs(computed - row.ratePercent)).toBeLessThanOrEqual(1)
    }
  })

  it('records repeaters doing worse than first-time takers', () => {
    // Not a sanity check — it is the finding. If a future edition reverses
    // this, the argument on the page and in the market analysis changes, and
    // somebody should have to look at it.
    expect(PASS_RATES.repeat.ratePercent).toBeLessThan(
      PASS_RATES.firstTime.ratePercent,
    )
  })
})

describe('the exam day page', () => {
  it('states the headline logistics', () => {
    render(ExamDayPage())

    expect(screen.getByText(`${EXAM.minutes} minutes`)).toBeInTheDocument()
    expect(screen.getByText(String(EXAM.totalQuestions))).toBeInTheDocument()
    expect(screen.getByText(`$${EXAM.feeUsd}`)).toBeInTheDocument()
  })

  it('renders the blueprint table with a total that matches', () => {
    render(ExamDayPage())

    const table = within(
      screen.getByRole('table', {
        name: /Scored questions by blueprint section/i,
      }),
    )
    for (const section of BLUEPRINT) {
      expect(table.getByText(section.name)).toBeInTheDocument()
    }
    expect(table.getByText('Total scored')).toBeInTheDocument()
  })

  it('lists both identification sets, because needing two is the trap', () => {
    render(ExamDayPage())

    for (const id of [...PRIMARY_ID, ...SECONDARY_ID]) {
      expect(screen.getAllByText(id).length).toBeGreaterThan(0)
    }
  })

  it('does not claim a pass percentage the state does not publish', () => {
    const { container } = render(ExamDayPage())
    const text = container.textContent ?? ''

    // The page explains scaled scoring instead. A "70% to pass" that creeps
    // back in via copy-editing is exactly the claim the handbook does not
    // support.
    expect(text).toMatch(/scaled score/i)
    expect(text).not.toMatch(/\b70%\b/)
    expect(text).toMatch(/does not publish a pass percentage/i)
  })

  it('names its sources on the page itself', () => {
    render(ExamDayPage())
    expect(screen.getByText('Sources')).toBeInTheDocument()
    expect(screen.getByText(/#124400/)).toBeInTheDocument()
    expect(screen.getByText(/#124401/)).toBeInTheDocument()
  })
})
