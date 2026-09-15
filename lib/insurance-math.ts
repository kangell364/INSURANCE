/**
 * The settlement arithmetic the exam tests.
 *
 * Two audiences, which is why this exists as code rather than only as prose:
 *
 *   1. The worked examples in content/ are checked against these functions in
 *      tests/insurance-math.test.ts. A lesson that teaches the coinsurance
 *      formula and then works an example wrongly is worse than no lesson, and
 *      prose cannot be unit-tested — so the examples are encoded as test
 *      cases and the library is the independent second opinion.
 *   2. The Phase 3 question generator will need exactly these calculations to
 *      produce and mark numeric questions.
 *
 * Nothing here is Texas-specific. It is the general-knowledge arithmetic from
 * blueprint sections GK.II and GK.V.
 */

/**
 * Actual cash value: replacement cost less depreciation.
 *
 * Depreciation is taken straight-line on age over expected life, which is how
 * the exam presents it. Real claims practice also recognises the broad
 * evidence rule, where a court may weigh market value, remaining useful life
 * and other factors; that is a judgement, not a formula, and is deliberately
 * not modelled here.
 */
export function actualCashValue(input: {
  replacementCost: number
  ageYears: number
  expectedLifeYears: number
}): number {
  const { replacementCost, ageYears, expectedLifeYears } = input
  if (expectedLifeYears <= 0) return replacementCost
  // Fully depreciated property is worth nothing under this method, but never
  // less than nothing — an item older than its expected life does not owe the
  // insurer money.
  const depreciationRate = Math.min(1, Math.max(0, ageYears / expectedLifeYears))
  return replacementCost * (1 - depreciationRate)
}

export type CoinsuranceInput = {
  /** The limit actually carried. */
  limitCarried: number
  /** The property's value AT THE TIME OF LOSS, not when written. */
  valueAtLoss: number
  /** The coinsurance requirement, as a percentage: 80 for 80%. */
  coinsurancePercent: number
  lossAmount: number
  deductible?: number
}

export type CoinsuranceResult = {
  /** The limit the clause required: coinsurance % × value at loss. */
  required: number
  /** limitCarried ÷ required, capped at 1. */
  ratio: number
  /** What the policy pays after the ratio, the deductible and the limit. */
  payment: number
  /** How much of the loss the insured bears. */
  uninsuredPortion: number
  /** True when the insured carried less than the clause required. */
  underinsured: boolean
}

/**
 * The coinsurance settlement: (Did ÷ Should) × Loss − Deductible.
 *
 * Three caps apply after the formula, and each is a question the exam asks:
 *
 *   * The ratio is capped at 1. Over-insuring never pays more than the loss —
 *     insurance is indemnity, not a wager.
 *   * The payment never exceeds the policy limit.
 *   * The payment never goes below zero, when the deductible exceeds the
 *     reduced loss.
 */
export function coinsurancePayment(
  input: CoinsuranceInput,
): CoinsuranceResult {
  const {
    limitCarried,
    valueAtLoss,
    coinsurancePercent,
    lossAmount,
    deductible = 0,
  } = input

  const required = (coinsurancePercent / 100) * valueAtLoss
  const ratio = required <= 0 ? 1 : Math.min(1, limitCarried / required)

  const afterRatio = ratio * lossAmount
  const afterDeductible = Math.max(0, afterRatio - deductible)
  const payment = Math.min(afterDeductible, limitCarried)

  return {
    required,
    ratio,
    payment,
    uninsuredPortion: lossAmount - payment,
    underinsured: limitCarried < required,
  }
}

/**
 * Bodily-injury payable under split limits, e.g. 100/300/50.
 *
 * Two caps in sequence, and the exam's favourite trap is applying only the
 * first: each claimant is capped at the per-person limit, and the TOTAL is
 * then capped at the per-accident limit.
 */
export function splitLimitBodilyInjury(input: {
  perPerson: number
  perAccident: number
  claims: number[]
}): { perClaimant: number[]; total: number } {
  const perClaimant = input.claims.map((c) => Math.min(c, input.perPerson))
  const uncapped = perClaimant.reduce((sum, c) => sum + c, 0)
  return { perClaimant, total: Math.min(uncapped, input.perAccident) }
}

/**
 * A percentage deductible.
 *
 * Taken against the INSURED VALUE, not against the loss. That is the whole
 * trap: 2% of a $400,000 dwelling is $8,000 no matter how small the damage,
 * which is why a percentage wind or hail deductible can absorb a claim
 * entirely.
 */
export function percentageDeductible(input: {
  insuredValue: number
  percent: number
  lossAmount: number
}): { deductible: number; payment: number } {
  const deductible = (input.percent / 100) * input.insuredValue
  return { deductible, payment: Math.max(0, input.lossAmount - deductible) }
}
