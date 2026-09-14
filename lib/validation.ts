/**
 * Form validation and auth-error normalisation.
 *
 * Pure functions with no framework or Supabase imports, so they are unit
 * tested directly and can be reused by a future server action without change.
 *
 * Client-side validation here is a convenience only. Supabase Auth enforces
 * its own password policy, and the database enforces its own constraints; a
 * client that skips this file cannot create anything invalid.
 */

export const MIN_PASSWORD_LENGTH = 8
export const MAX_NAME_LENGTH = 100

export type FieldErrors<T extends string> = Partial<Record<T, string>>

// Intentionally permissive: the authoritative check is the confirmation email
// actually arriving. Over-strict patterns reject valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

export type SignupFields =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'

export type SignupInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export function validateSignup(
  input: SignupInput,
): FieldErrors<SignupFields> {
  const errors: FieldErrors<SignupFields> = {}

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim()

  if (!firstName) {
    errors.firstName = 'Enter your first name.'
  } else if (firstName.length > MAX_NAME_LENGTH) {
    errors.firstName = `First name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  if (!lastName) {
    errors.lastName = 'Enter your last name.'
  } else if (lastName.length > MAX_NAME_LENGTH) {
    errors.lastName = `Last name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  if (!email) {
    errors.email = 'Enter your email address.'
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!input.password) {
    errors.password = 'Choose a password.'
  } else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Re-enter your password.'
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export type LoginFields = 'email' | 'password'

export function validateLogin(input: {
  email: string
  password: string
}): FieldErrors<LoginFields> {
  const errors: FieldErrors<LoginFields> = {}

  if (!input.email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!isValidEmail(input.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!input.password) errors.password = 'Enter your password.'

  return errors
}

export type ProfileFields = 'firstName' | 'lastName'

export function validateProfile(input: {
  firstName: string
  lastName: string
}): FieldErrors<ProfileFields> {
  const errors: FieldErrors<ProfileFields> = {}

  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!firstName) {
    errors.firstName = 'Enter your first name.'
  } else if (firstName.length > MAX_NAME_LENGTH) {
    errors.firstName = `First name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  if (!lastName) {
    errors.lastName = 'Enter your last name.'
  } else if (lastName.length > MAX_NAME_LENGTH) {
    errors.lastName = `Last name must be ${MAX_NAME_LENGTH} characters or fewer.`
  }

  return errors
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}

/**
 * Turns a Supabase Auth error into something safe to show a user.
 *
 * Two rules:
 *   1. Never reveal whether an email address is registered. "Invalid login
 *      credentials" must read the same whether the account exists or the
 *      password was wrong, otherwise the login form becomes an account
 *      enumeration oracle.
 *   2. Never render a raw provider message — it can leak internal detail and
 *      is rarely actionable.
 */
export function authErrorMessage(
  error: { message?: string; status?: number } | null | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error?.message) return fallback

  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'That email address and password combination is not correct.'
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address first. Check your inbox for the confirmation link.'
  }
  if (message.includes('email rate limit') || error.status === 429) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (message.includes('user already registered')) {
    // Signup deliberately does not confirm this either; see SignupForm, which
    // shows the neutral "check your email" screen regardless.
    return 'We could not create that account. If you already have one, sign in instead.'
  }
  if (message.includes('password')) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters and meet the security requirements.`
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'We could not reach the authentication service. Check your connection and try again.'
  }

  return fallback
}
