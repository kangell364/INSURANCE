/**
 * Domain types for Phase 1, derived from the database schema so that the two
 * can never drift apart.
 */
import type { Enums, Tables } from './database'

export type { Database, Json } from './database'

// --- Enumerations -----------------------------------------------------------

export type Role = Enums<'user_role'>
export type CourseStatus = Enums<'course_status'>
export type EnrollmentStatus = Enums<'enrollment_status'>

export const ROLES: readonly Role[] = ['student', 'instructor', 'admin']
export const COURSE_STATUSES: readonly CourseStatus[] = [
  'draft',
  'active',
  'archived',
]
export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  'active',
  'completed',
  'expired',
  'cancelled',
]

// --- Entities ---------------------------------------------------------------

export type Profile = Tables<'profiles'>
export type Course = Tables<'courses'>
export type Enrollment = Tables<'enrollments'>

/**
 * An enrollment joined to the course it points at — the shape
 * /dashboard/courses renders.
 */
export type EnrollmentWithCourse = Enrollment & {
  course: Pick<Course, 'id' | 'title' | 'slug' | 'description' | 'status'> | null
}

// --- Helpers ----------------------------------------------------------------

export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'admin'
}

/**
 * Best-effort display name. Falls back through last name, then the local part
 * of the email address, so the UI never renders "Welcome back, undefined".
 */
export function displayName(
  profile: Pick<Profile, 'first_name' | 'last_name' | 'email'> | null,
): string {
  if (!profile) return 'there'
  const first = profile.first_name?.trim()
  if (first) return first
  const last = profile.last_name?.trim()
  if (last) return last
  const local = profile.email?.split('@')[0]
  return local && local.length > 0 ? local : 'there'
}

export function fullName(
  profile: Pick<Profile, 'first_name' | 'last_name'> | null,
): string {
  if (!profile) return ''
  return [profile.first_name, profile.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export function enrollmentStatusLabel(status: EnrollmentStatus): string {
  return ENROLLMENT_STATUS_LABELS[status]
}
