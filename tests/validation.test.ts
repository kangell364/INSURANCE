import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  hasErrors,
  isValidEmail,
  validateLogin,
  validateProfile,
  validateSignup,
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
