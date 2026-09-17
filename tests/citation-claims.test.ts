import { describe, expect, it } from 'vitest'

import {
  claimsOf,
  judgeClaim,
  normalise,
  numbersIn,
  rangeAfter,
  sectionsOf,
  statuteHasNumber,
} from '../scripts/check-citation-claims.mjs'

/**
 * This check exists because of one specific error.
 *
 * Two lessons stated that Texas's 30/60/25 financial-responsibility floor
 * reaches PIP, citing §1952.105. §1952.105 is Subchapter C -- uninsured and
 * underinsured motorist coverage -- and never uses the words "personal injury
 * protection". PIP is Subchapter D, capped at $2,500 by §1952.153.
 *
 * check-citations.mjs passed it, because §1952.105 is a real section. The
 * course taught Texas law incorrectly until a human happened to read the
 * chapter. These assertions are the version of that human that runs in CI.
 */

// Verbatim from reference/statutes/IN.1952.txt, including the extractor's
// spaced apostrophes, because the check has to cope with the file as it is.
const SEC_1952_105 = `SUBCHAPTER C. UNINSURED OR UNDERINSURED MOTORIST COVERAGE
Sec. 1952.105. LIABILITY LIMITS.
(a) The limits of liability for bodily injury, sickness, disease, or death must
be offered to an insured in the amounts desired by the insured, but not in
amounts greater than the limits of liability specified in the bodily injury
liability provisions of the insured ' s policy.
(c) Notwithstanding Subsections (a) and (b), amounts of liability limits ...
may not be offered in amounts less than those prescribed by Chapter 601 ,
Transportation Code.`

const SEC_1952_153 = `SUBCHAPTER D. PERSONAL INJURY PROTECTION COVERAGE
Sec. 1952.153. MAXIMUM REQUIRED AMOUNT OF PERSONAL INJURY PROTECTION. This
subchapter does not require an insurer to provide personal injury protection
coverage in an amount that exceeds $2,500 for all benefits, in the aggregate,
for each person.`

describe('the error this check was built for', () => {
  it('flags a lesson that attaches PIP to §1952.105', () => {
    const wrong = "Texas's 30/60/25 floor also governs PIP (§1952.105)."
    const flags = judgeClaim(wrong, SEC_1952_105)
    expect(flags).toContainEqual({ kind: 'subject', what: 'personal injury protection' })
  })

  it('does not flag PIP against the section that actually governs it', () => {
    const right = 'PIP need not exceed $2,500 per person (§1952.153).'
    expect(judgeClaim(right, SEC_1952_153)).toEqual([])
  })

  it('flags the $2,500 cap if it is hung on the wrong section', () => {
    const wrong = 'PIP need not exceed $2,500 per person (§1952.105).'
    expect(judgeClaim(wrong, SEC_1952_105)).toContainEqual({ kind: 'number', what: '$2,500' })
  })
})

describe('the statute text as it actually comes out of the PDFs', () => {
  it('matches a subject the extractor spelled with a spaced apostrophe', () => {
    const statute = "The association shall pay the full amount of a covered claim " +
      "arising out of a workers ' compensation claim."
    const claim = "§462.213(b) requires payment in full on a workers' compensation claim."
    expect(judgeClaim(claim, statute)).toEqual([])
  })

  it('finds sections the extractor ran inline, not just at a line start', () => {
    // Verbatim shape of reference/statutes/IN.542A.txt, where the PDF gave no
    // line break before "Sec.". An anchored pattern found zero sections in it,
    // and the run then reported a downloaded chapter as never downloaded --
    // which is how I came to tell Duane to go and fetch a file he already had.
    const chapter = 'CHAPTER 542A. CERTAIN CONSUMER ACTIONS Sec. 542A.001. ' +
      'DEFINITIONS. In this chapter: (1) "Agent" means an employee. Added by ' +
      'Acts 2017, 85th Leg., Ch. 151, Sec. 3, eff. September 1, 2017. ' +
      'Sec. 542A.003. NOTICE REQUIRED. Not later than the 61st day before.'
    const sections = sectionsOf(chapter)
    expect([...sections.keys()]).toEqual(['542A.001', '542A.003'])
    // "Sec. 3, eff." is an enacting clause, not a section.
    expect([...sections.keys()]).not.toContain('3')
  })

  it('carries the subchapter heading into each section it extracts', () => {
    // sectionsOf is what actually attaches the heading. Asserting only via
    // judgeClaim with the heading pasted in by hand let a mutant that dropped
    // the heading entirely survive the whole suite.
    const chapter = `SUBCHAPTER C. UNINSURED OR UNDERINSURED MOTORIST COVERAGE
Sec. 1952.105. LIABILITY LIMITS. The limits must be offered to an insured.

SUBCHAPTER D. PERSONAL INJURY PROTECTION COVERAGE
Sec. 1952.153. MAXIMUM REQUIRED AMOUNT. Not more than $2,500 per person.`
    const sections = sectionsOf(chapter)
    expect(sections.get('1952.105')).toContain('UNINSURED OR UNDERINSURED')
    expect(sections.get('1952.153')).toContain('PERSONAL INJURY PROTECTION')
    // And the heading must be the right one, not simply the first in the file.
    expect(sections.get('1952.105')).not.toContain('PERSONAL INJURY PROTECTION')
  })

  it('reads a subject out of the subchapter heading, not just the section body', () => {
    // §1952.155 says "coverage required by this subchapter" and never the
    // words itself. Without the heading it would look like a section about
    // nothing, and every PIP claim citing it would flag.
    const statute = `SUBCHAPTER D. PERSONAL INJURY PROTECTION COVERAGE
Sec. 1952.155. BENEFITS PAYABLE WITHOUT REGARD TO FAULT. The benefits under
coverage required by this subchapter are payable without regard to fault.`
    expect(judgeClaim('PIP is paid without regard to fault (§1952.155).', statute)).toEqual([])
  })

  it('strips apostrophes on both sides so neither spelling wins', () => {
    expect(normalise("workers ' compensation")).toBe('workers compensation')
    expect(normalise("workers' compensation")).toBe('workers compensation')
  })
})

describe('numbers', () => {
  it('reads money, durations and percentages out of a claim', () => {
    const found = numbersIn('Pay $2,500 within 30 days, up to 80% of value.')
    expect([...found].sort()).toEqual(['$2,500', '30 days', '80%'])
  })

  it('does not let a longer number satisfy a shorter one', () => {
    expect(statuteHasNumber('30 days', 'not later than the 300th day')).toBe(false)
    expect(statuteHasNumber('30 days', 'in 1930 the legislature')).toBe(false)
    expect(statuteHasNumber('30 days', 'before the 30th day')).toBe(true)
  })

  it('treats $2,500 and the statute’s 2,500 as the same figure', () => {
    expect(statuteHasNumber('$2,500', 'an amount that exceeds 2,500 for all benefits')).toBe(true)
  })
})

describe('claim boundaries', () => {
  it('keeps a hard-wrapped sentence together', () => {
    // This split in half once, and the check then reported the $30,000 as
    // unsupported because it could no longer see the citation supporting it.
    const text = '7. **$30,000** — §601.003 treats the judgment as satisfied\n' +
      '   once the amount required by §601.072(a-1)(1) is credited.\n'
    const claims = claimsOf(text).map(([a, b]) => text.slice(a, b))
    const holding = claims.find((c) => c.includes('30,000'))
    expect(holding).toContain('601.072')
  })

  it('does not run two list items together', () => {
    const text = '- First, §541.051 forbids misrepresentation.\n- Second, §541.052 forbids defamation.\n'
    const claims = claimsOf(text).map(([a, b]) => text.slice(a, b))
    expect(claims.some((c) => c.includes('541.051') && c.includes('541.052'))).toBe(false)
  })
})

describe('citation ranges', () => {
  // A chapter stub standing in for reference/statutes/, so the test does not
  // depend on which chapters happen to be downloaded.
  const chapter = new Map([
    ['4004.051', ''], ['4004.052', ''], ['4004.053', ''],
    ['4004.054', ''], ['4004.055', ''], ['4004.101', ''],
  ])
  const lookup = () => chapter

  it('reads §4004.051-.055 as covering every section between', () => {
    const text = 'a 90-day window to cure a shortfall (§4004.051–.055).'
    const m = /§\s?(\d{2,4}[A-Z]?)\.(\d+)/.exec(text) as RegExpExecArray
    expect(rangeAfter(text, m, lookup).sort()).toEqual([
      '4004.051', '4004.052', '4004.053', '4004.054', '4004.055',
    ])
  })

  it('does not drag in a section past the end of the range', () => {
    const text = '(§4004.051–.055)'
    const m = /§\s?(\d{2,4}[A-Z]?)\.(\d+)/.exec(text) as RegExpExecArray
    expect(rangeAfter(text, m, lookup)).not.toContain('4004.101')
  })

  it('leaves a lone citation alone', () => {
    const text = 'under §4004.051 the hours must be complete.'
    const m = /§\s?(\d{2,4}[A-Z]?)\.(\d+)/.exec(text) as RegExpExecArray
    expect(rangeAfter(text, m, lookup)).toEqual([])
  })

  it('is not fooled by a subsection reference that follows', () => {
    const text = '§4004.051(c) requires half in a classroom.'
    const m = /§\s?(\d{2,4}[A-Z]?)\.(\d+)/.exec(text) as RegExpExecArray
    expect(rangeAfter(text, m, lookup)).toEqual([])
  })
})
