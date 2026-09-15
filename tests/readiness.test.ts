import { describe, expect, it } from 'vitest'
import {
  ALMOST_THRESHOLD,
  READY_THRESHOLD,
  STATE_PASS_MARK,
  readinessBand,
  readinessScale,
} from '@/lib/readiness'

describe('the readiness scale', () => {
  it('tells a student to book only at or above the threshold', () => {
    expect(readinessBand(READY_THRESHOLD).band).toBe('ready')
    expect(readinessBand(READY_THRESHOLD - 1).band).toBe('almost')
  })

  it('keeps a margin over the state pass mark', () => {
    // The point of decision D. If these ever converge, a student who scrapes
    // our bar has a coin-flip on the day and will blame us for the fee.
    expect(READY_THRESHOLD).toBeGreaterThan(STATE_PASS_MARK)
  })

  it('places the bands in the right order', () => {
    expect(ALMOST_THRESHOLD).toBeLessThan(READY_THRESHOLD)
    expect(readinessBand(0).band).toBe('not-ready')
    expect(readinessBand(ALMOST_THRESHOLD).band).toBe('almost')
    expect(readinessBand(100).band).toBe('ready')
  })

  it('clamps rather than throwing on out-of-range input', () => {
    expect(readinessBand(100.0001).band).toBe('ready')
    expect(readinessBand(-5).band).toBe('not-ready')
    expect(readinessBand(Number.NaN).band).toBe('not-ready')
  })

  it('gives every band an actionable next step', () => {
    for (const band of readinessScale()) {
      expect(band.advice.length).toBeGreaterThan(0)
      expect(band.label.length).toBeGreaterThan(0)
    }
  })

  it('describes a scale with no gaps and no overlaps', () => {
    const scale = readinessScale()
    expect(scale[0].from).toBe(0)
    expect(scale.at(-1)?.to).toBe(100)
    for (let i = 1; i < scale.length; i += 1) {
      expect(scale[i].from).toBe(scale[i - 1].to + 1)
    }
  })
})
