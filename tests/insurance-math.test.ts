import { describe, expect, it } from 'vitest'
import {
  actualCashValue,
  coinsurancePayment,
  percentageDeductible,
  splitLimitBodilyInjury,
} from '@/lib/insurance-math'

/* ==========================================================================
   Every worked example printed in content/ is reproduced here.

   A lesson that teaches the coinsurance formula and then works its own
   example wrongly is worse than no lesson — the student learns the method and
   distrusts it when their answer disagrees. Prose cannot be unit-tested, so
   the examples are encoded as cases and the library is the second opinion.

   If a lesson's numbers change, change them here too, and let the test say
   whether the new ones are right.
   ========================================================================== */

describe('valuing-a-loss.md worked examples', () => {
  it('the $20,000 roof at 15 of 20 years', () => {
    expect(
      actualCashValue({
        replacementCost: 20_000,
        ageYears: 15,
        expectedLifeYears: 20,
      }),
    ).toBe(5_000)
  })

  it('the $8,000 air-conditioning unit at 5 of 10 years', () => {
    expect(
      actualCashValue({
        replacementCost: 8_000,
        ageYears: 5,
        expectedLifeYears: 10,
      }),
    ).toBe(4_000)
  })

  it('never returns a negative value for property past its life', () => {
    expect(
      actualCashValue({
        replacementCost: 8_000,
        ageYears: 30,
        expectedLifeYears: 10,
      }),
    ).toBe(0)
  })
})

describe('deductibles-coinsurance-and-limits.md worked examples', () => {
  it('the $500,000 building, 80% coinsurance, $300,000 limit', () => {
    const result = coinsurancePayment({
      limitCarried: 300_000,
      valueAtLoss: 500_000,
      coinsurancePercent: 80,
      lossAmount: 100_000,
      deductible: 1_000,
    })

    expect(result.required).toBe(400_000)
    expect(result.ratio).toBe(0.75)
    expect(result.payment).toBe(74_000)
    // The lesson states the insured is $26,000 short.
    expect(result.uninsuredPortion).toBe(26_000)
    expect(result.underinsured).toBe(true)
  })

  it('check-yourself 1: the $800,000 building', () => {
    const result = coinsurancePayment({
      limitCarried: 500_000,
      valueAtLoss: 800_000,
      coinsurancePercent: 80,
      lossAmount: 200_000,
      deductible: 2_500,
    })

    expect(result.required).toBe(640_000)
    expect(result.ratio).toBeCloseTo(0.78125, 5)
    expect(result.payment).toBe(153_750)
  })

  it('check-yourself 2: the 2% wind deductible on $350,000', () => {
    const result = percentageDeductible({
      insuredValue: 350_000,
      percent: 2,
      lossAmount: 12_000,
    })

    expect(result.deductible).toBe(7_000)
    expect(result.payment).toBe(5_000)
  })

  it('the 100/300/50 example: four claimants at $90,000', () => {
    const result = splitLimitBodilyInjury({
      perPerson: 100_000,
      perAccident: 300_000,
      claims: [90_000, 90_000, 90_000, 90_000],
    })

    // Each is inside the per-person limit...
    expect(result.perClaimant).toEqual([90_000, 90_000, 90_000, 90_000])
    // ...but the total is capped by the per-accident limit.
    expect(result.total).toBe(300_000)
  })

  it('check-yourself 3: 250/500/100 with three claimants', () => {
    const result = splitLimitBodilyInjury({
      perPerson: 250_000,
      perAccident: 500_000,
      claims: [200_000, 200_000, 150_000],
    })

    expect(result.total).toBe(500_000)
  })
})

describe('the caps the lessons claim', () => {
  it('over-insuring does not pay more than the loss', () => {
    // "Insurance never pays more than the loss" — check-yourself 4.
    const result = coinsurancePayment({
      limitCarried: 1_000_000,
      valueAtLoss: 500_000,
      coinsurancePercent: 80,
      lossAmount: 100_000,
    })

    expect(result.ratio).toBe(1)
    expect(result.payment).toBe(100_000)
    expect(result.underinsured).toBe(false)
  })

  it('caps a payment at the policy limit', () => {
    const result = coinsurancePayment({
      limitCarried: 50_000,
      valueAtLoss: 50_000,
      coinsurancePercent: 80,
      lossAmount: 60_000,
    })
    expect(result.payment).toBe(50_000)
  })

  it('never pays below zero when the deductible swallows the loss', () => {
    const result = coinsurancePayment({
      limitCarried: 100_000,
      valueAtLoss: 100_000,
      coinsurancePercent: 80,
      lossAmount: 500,
      deductible: 1_000,
    })
    expect(result.payment).toBe(0)
  })

  it('applies the per-person limit before the per-accident limit', () => {
    // One very large claim must be cut to the per-person limit first.
    const result = splitLimitBodilyInjury({
      perPerson: 100_000,
      perAccident: 300_000,
      claims: [500_000],
    })
    expect(result.perClaimant).toEqual([100_000])
    expect(result.total).toBe(100_000)
  })
})
