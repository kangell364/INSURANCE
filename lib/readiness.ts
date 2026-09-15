/**
 * The readiness scale.
 *
 * DECISION D (docs/phase-2-design.md): a student is told to book the exam at
 * 80%, and the answer is given as one of three bands rather than as a bare
 * number.
 *
 * Why 80 and not 70. The Texas state examination passes at 70%. Setting our
 * threshold to match it would mean a student who scrapes past our bar has
 * roughly even odds on the day — and practice conditions are always kinder
 * than a Pearson VUE testing centre, so our 70% is not the state's 70%. Ten
 * points of margin is the difference between "you are ready" being a
 * prediction and being a hope.
 *
 * Why bands and not a number. A single percentage invites a student to grind
 * it upward by one point at a time. What actually helps them is a clear
 * answer to "should I book the test yet", plus the list of topics dragging the
 * number down. The bands give the first; the topic breakdown gives the second.
 *
 * WHY THIS FILE EXISTS AT ALL, given nothing scores anything yet: the numbers
 * below are a product promise, and a product promise that lives in three
 * components drifts. When scoring lands it consumes these constants.
 *
 * Bump SCALE_VERSION when a threshold changes, and stamp it on any stored
 * readiness result. A score recorded under one scale and displayed under
 * another is a number that means nothing.
 */

export const SCALE_VERSION = 1

/** The percentage at which the product tells a student to book the exam. */
export const READY_THRESHOLD = 80

/** Below this, a student is not close and should keep studying. */
export const ALMOST_THRESHOLD = 65

/** The mark the state examination itself passes at, for context only. */
export const STATE_PASS_MARK = 70

export type ReadinessBand = 'not-ready' | 'almost' | 'ready'

export type ReadinessBandDetail = {
  band: ReadinessBand
  label: string
  /** One sentence telling the student what to do next. */
  advice: string
}

const BANDS: Record<ReadinessBand, ReadinessBandDetail> = {
  'not-ready': {
    band: 'not-ready',
    label: 'Not ready',
    advice:
      'Keep working through the lessons. Your weakest topics are listed below.',
  },
  almost: {
    band: 'almost',
    label: 'Getting there',
    advice:
      'You are close. Focus on your weakest topics rather than retaking whole exams.',
  },
  ready: {
    band: 'ready',
    label: 'Ready to book',
    advice:
      'You are consistently scoring above the mark. Book the state examination.',
  },
}

/**
 * The band a readiness percentage falls into.
 *
 * Scores are clamped rather than rejected: a rounding error that produces
 * 100.0001 should place a student in the top band, not throw on the page that
 * was about to congratulate them.
 */
export function readinessBand(score: number): ReadinessBandDetail {
  if (!Number.isFinite(score)) return BANDS['not-ready']
  const clamped = Math.min(100, Math.max(0, score))
  if (clamped >= READY_THRESHOLD) return BANDS.ready
  if (clamped >= ALMOST_THRESHOLD) return BANDS.almost
  return BANDS['not-ready']
}

/** Every band, lowest first — for rendering the scale before any score exists. */
export function readinessScale(): (ReadinessBandDetail & {
  from: number
  to: number
})[] {
  return [
    { ...BANDS['not-ready'], from: 0, to: ALMOST_THRESHOLD - 1 },
    { ...BANDS.almost, from: ALMOST_THRESHOLD, to: READY_THRESHOLD - 1 },
    { ...BANDS.ready, from: READY_THRESHOLD, to: 100 },
  ]
}
