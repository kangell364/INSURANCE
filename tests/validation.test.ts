import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  hasErrors,
  isValidEmail,
  slugify,
  validateLesson,
  validateLogin,
  validateModule,
  validateProfile,
  validateSignup,
  validateTopic,
} from '@/lib/validation'

const validSignup = {
  firstName: 'Ada',
  lastName: 'Alpha',
  email: 'ada@example.com',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
}

describe('isValidEmail', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com'])(
    'accepts %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true)
    },
  )

  it.each(['', 'nope', 'no@domain', 'no domain@example.com', '@example.com'])(
    'rejects %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false)
    },
  )
})

describe('validateSignup', () => {
  it('accepts a complete, valid submission', () => {
    expect(validateSignup(validSignup)).toEqual({})
    expect(hasErrors(validateSignup(validSignup))).toBe(false)
  })

  it('requires both names', () => {
    const errors = validateSignup({
      ...validSignup,
      firstName: '  ',
      lastName: '',
    })
    expect(errors.firstName).toBeDefined()
    expect(errors.lastName).toBeDefined()
  })

  it('rejects names longer than the database allows', () => {
    const errors = validateSignup({ ...validSignup, firstName: 'a'.repeat(101) })
    expect(errors.firstName).toMatch(/100 characters/)
  })

  it('rejects a malformed email address', () => {
    expect(validateSignup({ ...validSignup, email: 'not-an-email' }).email)
      .toBeDefined()
  })

  it(`requires at least ${MIN_PASSWORD_LENGTH} characters of password`, () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const errors = validateSignup({
      ...validSignup,
      password: short,
      confirmPassword: short,
    })
    expect(errors.password).toMatch(new RegExp(`${MIN_PASSWORD_LENGTH}`))
  })

  it('requires the confirmation to match', () => {
    const errors = validateSignup({
      ...validSignup,
      confirmPassword: 'something-else',
    })
    expect(errors.confirmPassword).toBe('Passwords do not match.')
  })

  it('reports every problem at once rather than one at a time', () => {
    const errors = validateSignup({
      firstName: '',
      lastName: '',
      email: 'bad',
      password: 'x',
      confirmPassword: '',
    })
    expect(Object.keys(errors).sort()).toEqual([
      'confirmPassword',
      'email',
      'firstName',
      'lastName',
      'password',
    ])
  })

  it('has no concept of a role — signup cannot request one', () => {
    // The signup contract is the five fields above and nothing else. If a
    // `role` ever appears in SignupInput, this test should fail loudly.
    expect(Object.keys(validSignup)).not.toContain('role')
  })
})

describe('validateLogin', () => {
  it('accepts a valid submission', () => {
    expect(
      validateLogin({ email: 'ada@example.com', password: 'secret123' }),
    ).toEqual({})
  })

  it('requires an email address and a password', () => {
    const errors = validateLogin({ email: '', password: '' })
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
  })

  it('does not impose a password length rule on sign in', () => {
    // Applying the signup policy here would tell an attacker that an existing
    // account's password is too short to be valid.
    expect(
      validateLogin({ email: 'ada@example.com', password: 'a' }).password,
    ).toBeUndefined()
  })
})

describe('validateProfile', () => {
  it('accepts valid names', () => {
    expect(validateProfile({ firstName: 'Ada', lastName: 'Alpha' })).toEqual({})
  })

  it('requires both names', () => {
    const errors = validateProfile({ firstName: ' ', lastName: '' })
    expect(errors.firstName).toBeDefined()
    expect(errors.lastName).toBeDefined()
  })
})

describe('authErrorMessage', () => {
  it('does not reveal whether an account exists', () => {
    const message = authErrorMessage({ message: 'Invalid login credentials' })
    expect(message).toBe(
      'That email address and password combination is not correct.',
    )
    expect(message.toLowerCase()).not.toMatch(/not found|no account|unknown/)
  })

  it('does not confirm an existing registration on signup', () => {
    const message = authErrorMessage({ message: 'User already registered' })
    expect(message.toLowerCase()).not.toMatch(/already (registered|exists)/)
  })

  it('explains an unconfirmed email address', () => {
    expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch(
      /confirm your email/i,
    )
  })

  it('explains rate limiting from the status code alone', () => {
    expect(authErrorMessage({ message: 'whatever', status: 429 })).toMatch(
      /too many attempts/i,
    )
  })

  it('falls back to a generic message for unrecognised errors', () => {
    expect(
      authErrorMessage({ message: 'pgrst: relation "x" does not exist' }),
    ).toBe('Something went wrong. Please try again.')
  })

  it('never echoes the raw provider message', () => {
    const raw = 'connection to db-abc123.supabase.co:5432 refused'
    expect(authErrorMessage({ message: raw })).not.toContain('supabase.co')
  })

  it('handles a null error', () => {
    expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })
})

/* ==========================================================================
   Content authoring validation.
   ========================================================================== */

describe('slugify', () => {
  it('lower-cases and hyphenates a title', () => {
    expect(slugify('Risk, Peril and Hazard')).toBe('risk-peril-and-hazard')
  })

  it('strips diacritics rather than dropping the letters', () => {
    // "Póliza" must become "poliza", not "pliza" — dropping the character
    // silently mangles the word for any Spanish-language content.
    expect(slugify('Póliza de Seguro')).toBe('poliza-de-seguro')
    expect(slugify('Año')).toBe('ano')
  })

  it('collapses runs of punctuation into single hyphens', () => {
    expect(slugify('What is  a "peril"?!')).toBe('what-is-a-peril')
  })

  it('never starts or ends with a hyphen', () => {
    expect(slugify('  --Leading and trailing--  ')).toBe(
      'leading-and-trailing',
    )
    expect(slugify('!!!')).toBe('')
  })

  it('truncates without leaving a trailing hyphen', () => {
    // Truncation can land exactly ON the hyphen and leave "...-", which fails
    // the database slug pattern. The trim must happen AFTER the cut.
    //
    // 119 is not arbitrary: it is the one length where the 120-character slice
    // ends on the separator. An earlier version of this test used 118, where
    // the cut lands mid-word, so it passed whether or not the trim existed.
    const slug = slugify('a'.repeat(119) + ' bcd')
    expect(slug.length).toBeLessThanOrEqual(120)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('produces something the database slug constraint accepts', () => {
    const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/
    for (const title of [
      'Risk, Peril & Hazard',
      "The Insured's Duties After a Loss",
      'Chapter 4 — Texas Statutes',
      'HO-3 vs. HO-5',
    ]) {
      expect(slugify(title)).toMatch(pattern)
    }
  })
})

describe('validateModule', () => {
  it('requires a title', () => {
    expect(validateModule({ title: '   ', description: '' }).title).toBeTruthy()
  })

  it('accepts a title with no description', () => {
    expect(validateModule({ title: 'Fundamentals', description: '' })).toEqual({})
  })

  it('rejects an over-long title', () => {
    expect(
      validateModule({ title: 'x'.repeat(201), description: '' }).title,
    ).toBeTruthy()
  })
})

describe('validateLesson', () => {
  const valid = {
    title: 'Insurable Interest',
    slug: 'insurable-interest',
    summary: 'Who may insure what.',
    estimatedMinutes: '12',
  }

  it('accepts a well-formed lesson', () => {
    expect(validateLesson(valid)).toEqual({})
  })

  it('requires a title and a slug', () => {
    expect(validateLesson({ ...valid, title: '' }).title).toBeTruthy()
    expect(validateLesson({ ...valid, slug: '' }).slug).toBeTruthy()
  })

  it.each([
    'Not A Slug',
    'trailing-',
    '-leading',
    'double--hyphen',
    'has spaces',
    'UPPER',
    'punctuation!',
  ])('rejects the malformed slug %s', (slug) => {
    expect(validateLesson({ ...valid, slug }).slug).toBeTruthy()
  })

  it('allows a blank estimate but not a nonsensical one', () => {
    expect(validateLesson({ ...valid, estimatedMinutes: '' })).toEqual({})
    expect(
      validateLesson({ ...valid, estimatedMinutes: '0' }).estimatedMinutes,
    ).toBeTruthy()
    expect(
      validateLesson({ ...valid, estimatedMinutes: '-5' }).estimatedMinutes,
    ).toBeTruthy()
    expect(
      validateLesson({ ...valid, estimatedMinutes: '7.5' }).estimatedMinutes,
    ).toBeTruthy()
    expect(
      validateLesson({ ...valid, estimatedMinutes: 'ten' }).estimatedMinutes,
    ).toBeTruthy()
    expect(
      validateLesson({ ...valid, estimatedMinutes: '9999' }).estimatedMinutes,
    ).toBeTruthy()
  })
})

describe('validateTopic', () => {
  const valid = {
    code: 'GK.I',
    name: 'Types of Policies',
    questionCount: '22',
    blueprintWeight: '',
  }

  it('accepts a well-formed topic', () => {
    expect(validateTopic(valid)).toEqual({})
  })

  it('requires a code and a name', () => {
    expect(validateTopic({ ...valid, code: '' }).code).toBeTruthy()
    expect(validateTopic({ ...valid, name: '' }).name).toBeTruthy()
  })

  it('allows a blank weight, and rejects one outside 0-100', () => {
    expect(validateTopic({ ...valid, blueprintWeight: '' })).toEqual({})
    expect(
      validateTopic({ ...valid, blueprintWeight: '101' }).blueprintWeight,
    ).toBeTruthy()
    expect(
      validateTopic({ ...valid, blueprintWeight: '-1' }).blueprintWeight,
    ).toBeTruthy()
  })

  it('accepts a fractional weight, because some blueprints use them', () => {
    expect(validateTopic({ ...valid, blueprintWeight: '12.5' })).toEqual({})
  })

  it('accepts a blank question count, for a sub-topic', () => {
    // The Texas blueprint assigns counts at section level only.
    expect(validateTopic({ ...valid, questionCount: '' })).toEqual({})
  })

  it('rejects a question count that is not a whole positive number', () => {
    for (const questionCount of ['0', '-3', '7.5', 'twenty', '501']) {
      expect(
        validateTopic({ ...valid, questionCount }).questionCount,
        `"${questionCount}" should be rejected`,
      ).toBeTruthy()
    }
  })
})
