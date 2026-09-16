import { describe, expect, it } from 'vitest'
import { readinessBand, READY_THRESHOLD, ALMOST_THRESHOLD } from '@/lib/readiness'

/**
 * The arithmetic and the claims on the exam screens.
 *
 * lib/attempts.ts is mostly a thin wrapper over two database functions, and
 * wrapping them in mocks would test the mocks. What IS worth pinning is the
 * handful of decisions this feature makes on its own: how a score becomes a
 * percentage, what "no mocks yet" means, and the sentence we are allowed to
 * put next to a result.
 */

/** The same computation the pages do, extracted so it can be asserted. */
function scorePercent(correct: number, asked: number): number | null {
  if (asked <= 0) return null
  return Math.round((correct / asked) * 100)
}

describe('score percentage', () => {
  it('rounds to a whole percent', () => {
    expect(scorePercent(104, 130)).toBe(80)
    expect(scorePercent(87, 130)).toBe(67)
  })

  it('returns null rather than dividing by zero on an empty paper', () => {
    // start_attempt() refuses to create one, but a page that crashed here
    // would turn a database guarantee into a 500 if that ever changed.
    expect(scorePercent(0, 0)).toBeNull()
  })

  it('does not report a full score for a nearly-full one', () => {
    // 129/130 is 99.23%, and rounding it to 100 would tell a student they
    // answered everything correctly when they did not.
    expect(scorePercent(129, 130)).toBe(99)
  })
})

describe('readiness bands on the exam screens', () => {
  it('places the threshold score in the ready band', () => {
    expect(readinessBand(READY_THRESHOLD).band).toBe('ready')
  })

  it('places one below the threshold outside it', () => {
    expect(readinessBand(READY_THRESHOLD - 1).band).not.toBe('ready')
  })

  it('separates almost from not-ready at its own threshold', () => {
    expect(readinessBand(ALMOST_THRESHOLD).band).toBe('almost')
    expect(readinessBand(ALMOST_THRESHOLD - 1).band).toBe('not-ready')
  })

  it('gives every band advice to act on', () => {
    for (const score of [0, 50, 70, 85, 100]) {
      expect(readinessBand(score).advice.length).toBeGreaterThan(0)
    }
  })
})

describe('what a result may claim', () => {
  /**
   * Texas publishes no pass percentage: the reported score is an equated
   * scaled score and the cut score is not disclosed. So no band may imply
   * that a practice score predicts the state exam.
   *
   * This asserts on the copy because the copy is the risk. A developer
   * editing "above the mark" into "you will pass" is making a regulated
   * claim, and TDI regulates advertising by licence holders.
   */
  it('no band claims the student would pass the state exam', () => {
    for (const score of [0, 40, 65, 80, 100]) {
      const { label, advice } = readinessBand(score)
      const text = `${label} ${advice}`.toLowerCase()
      expect(text).not.toMatch(/\bwill pass\b/)
      expect(text).not.toMatch(/\byou would pass\b/)
      expect(text).not.toMatch(/\bguarantee/)
      expect(text).not.toMatch(/\bpass rate\b/)
    }
  })

  it('the top band still tells them to book, without promising an outcome', () => {
    const top = readinessBand(100)
    expect(top.advice.toLowerCase()).toContain('book')
  })
})

/**
 * The weakest-first ordering on the results screen.
 *
 * Extracted rather than imported because getTopicBreakdown talks to the
 * database; what is worth pinning is the decision it makes AFTER the rows come
 * back, which is what the student actually sees.
 */
type Topic = { code: string; correct: number; asked: number }

function rank(topics: Topic[]) {
  return topics
    .map((t) => ({
      ...t,
      scorePercent: t.asked > 0 ? Math.round((t.correct / t.asked) * 100) : 0,
    }))
    .sort((a, b) => a.scorePercent - b.scorePercent || a.code.localeCompare(b.code))
}

describe('topic breakdown', () => {
  it('puts the weakest topic first, because that is the advice', () => {
    const ranked = rank([
      { code: 'GK.I', correct: 20, asked: 22 },
      { code: 'GK.IV', correct: 9, asked: 23 },
      { code: 'TX.I', correct: 14, asked: 18 },
    ])
    expect(ranked[0].code).toBe('GK.IV')
    expect(ranked[ranked.length - 1].code).toBe('GK.I')
  })

  it('breaks ties by blueprint code, so the order does not shuffle', () => {
    // Two topics on the same score must not swap between renders; a results
    // page that reorders itself looks broken.
    const a = rank([
      { code: 'TX.II', correct: 6, asked: 12 },
      { code: 'GK.VI', correct: 6, asked: 12 },
    ])
    const b = rank([
      { code: 'GK.VI', correct: 6, asked: 12 },
      { code: 'TX.II', correct: 6, asked: 12 },
    ])
    expect(a.map((t) => t.code)).toEqual(b.map((t) => t.code))
    expect(a[0].code).toBe('GK.VI')
  })

  it('scores a topic with no questions as zero rather than dividing by zero', () => {
    expect(rank([{ code: 'GK.I', correct: 0, asked: 0 }])[0].scorePercent).toBe(0)
  })
})

/** The countdown display. Copied from ExamTimer so the format is pinned. */
function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

describe('exam timer display', () => {
  it('shows hours while the paper is long', () => {
    expect(formatRemaining(150 * 60)).toBe('2:30:00')
  })

  it('drops to minutes and seconds inside the last hour', () => {
    expect(formatRemaining(59 * 60 + 5)).toBe('59:05')
  })

  it('never renders a negative clock', () => {
    // The latch in ExamTimer submits at zero, but a slow render tick must not
    // flash "-00:01" at somebody whose paper is being submitted.
    expect(formatRemaining(-30)).toBe('00:00')
  })

  it('pads so the digits do not jump about as they count down', () => {
    expect(formatRemaining(61)).toBe('01:01')
    expect(formatRemaining(9)).toBe('00:09')
  })
})
