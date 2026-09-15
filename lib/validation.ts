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

/* ==========================================================================
   Content authoring.

   Same posture as the rest of this file: these rules are a convenience for
   the person typing. The database enforces its own — length checks, the slug
   pattern, position uniqueness, the topic-depth trigger — and rejects
   anything that gets past here. Nothing below is load-bearing for security.
   ========================================================================== */

export const MAX_TITLE_LENGTH = 200
export const MAX_SLUG_LENGTH = 120
export const MAX_SUMMARY_LENGTH = 300
export const MAX_TOPIC_CODE_LENGTH = 60
export const MAX_ESTIMATED_MINUTES = 600

/** Matches the `courses_slug_format` / `lessons_slug_format` check constraints. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Derives a URL slug from a title.
 *
 * Offered as a default in the authoring forms rather than applied silently:
 * a slug is part of a public URL, and changing one later breaks every link
 * and every search result pointing at it. The author should see what they are
 * committing to.
 *
 * Diacritics are decomposed and stripped rather than dropped wholesale, so
 * "Póliza" becomes "poliza" and not "pliza".
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

export type ModuleFields = 'title' | 'description'

export function validateModule(input: {
  title: string
  description: string
}): FieldErrors<ModuleFields> {
  const errors: FieldErrors<ModuleFields> = {}
  const title = input.title.trim()

  if (!title) {
    errors.title = 'Give the module a title.'
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
  }

  if (input.description.trim().length > 1000) {
    errors.description = 'Description must be 1000 characters or fewer.'
  }

  return errors
}

export type LessonFields = 'title' | 'slug' | 'summary' | 'estimatedMinutes'

export function validateLesson(input: {
  title: string
  slug: string
  summary: string
  estimatedMinutes: string
}): FieldErrors<LessonFields> {
  const errors: FieldErrors<LessonFields> = {}
  const title = input.title.trim()
  const slug = input.slug.trim()

  if (!title) {
    errors.title = 'Give the lesson a title.'
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
  }

  if (!slug) {
    errors.slug = 'The lesson needs a web address.'
  } else if (slug.length > MAX_SLUG_LENGTH) {
    errors.slug = `Web address must be ${MAX_SLUG_LENGTH} characters or fewer.`
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug =
      'Use lower-case letters, numbers and hyphens only, for example ' +
      '"risk-peril-and-hazard".'
  }

  if (input.summary.trim().length > MAX_SUMMARY_LENGTH) {
    errors.summary = `Summary must be ${MAX_SUMMARY_LENGTH} characters or fewer.`
  }

  const minutes = input.estimatedMinutes.trim()
  if (minutes) {
    const parsed = Number(minutes)
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.estimatedMinutes = 'Enter a whole number of minutes, or leave blank.'
    } else if (parsed > MAX_ESTIMATED_MINUTES) {
      errors.estimatedMinutes = `That is longer than ${MAX_ESTIMATED_MINUTES} minutes — check the figure.`
    }
  }

  return errors
}

export type TopicFields = 'code' | 'name' | 'blueprintWeight'

export function validateTopic(input: {
  code: string
  name: string
  blueprintWeight: string
}): FieldErrors<TopicFields> {
  const errors: FieldErrors<TopicFields> = {}
  const code = input.code.trim()
  const name = input.name.trim()

  if (!code) {
    errors.code = 'Give the topic its blueprint code.'
  } else if (code.length > MAX_TOPIC_CODE_LENGTH) {
    errors.code = `Code must be ${MAX_TOPIC_CODE_LENGTH} characters or fewer.`
  }

  if (!name) {
    errors.name = 'Give the topic a name.'
  } else if (name.length > MAX_TITLE_LENGTH) {
    errors.name = `Name must be ${MAX_TITLE_LENGTH} characters or fewer.`
  }

  const weight = input.blueprintWeight.trim()
  if (weight) {
    const parsed = Number(weight)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors.blueprintWeight =
        'Enter the published percentage between 0 and 100, or leave blank.'
    }
  }

  return errors
}
