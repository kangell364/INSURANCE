import { describe, expect, it } from 'vitest'
import {
  ALMOST_THRESHOLD,
  READY_THRESHOLD,
  readinessBand,
  readinessScale,
} from '@/lib/readiness'

describe('the readiness scale', () => {
  it('tells a student to book only at or above the threshold', () => {
    expect(readinessBand(READY_THRESHOLD).band).toBe('ready')
    expect(readinessBand(READY_THRESHOLD - 1).band).toBe('almost')
  })

  it('exports no state pass mark, because Texas publishes none', () => {
    // Publication #124400 reports a SCALED score set by the Department of
    // Insurance, equated across exam forms. There is no published percentage
    // for a practice score to be calibrated against, and a constant claiming
    // otherwise invites code that compares two different things.
    //
    // Imported lazily so this test fails loudly if the constant returns.
    return import('@/lib/readiness').then((mod) => {
      expect('STATE_PASS_MARK' in mod).toBe(false)
    })
  })

  it('sets the ready threshold well above a coin flip', () => {
    // The bar is ours, not the state's, but it still has to mean something:
    // telling somebody they are ready at 55% would be worse than silence.
    expect(READY_THRESHOLD).toBeGreaterThanOrEqual(75)
    expect(READY_THRESHOLD).toBeLessThanOrEqual(90)
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
