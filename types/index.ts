/**
 * Domain types, derived from the database schema so that the two can never
 * drift apart.
 */
import type { Enums, Tables } from './database'

export type { Database, Json } from './database'

// --- Enumerations -----------------------------------------------------------

export type Role = Enums<'user_role'>
export type CourseStatus = Enums<'course_status'>
export type EnrollmentStatus = Enums<'enrollment_status'>
export type ContentStatus = Enums<'content_status'>

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
export const CONTENT_STATUSES: readonly ContentStatus[] = [
  'draft',
  'active',
  'archived',
]

// --- Entities ---------------------------------------------------------------

export type Profile = Tables<'profiles'>
export type Course = Tables<'courses'>
export type Enrollment = Tables<'enrollments'>
export type Module = Tables<'modules'>
export type Lesson = Tables<'lessons'>
export type LessonContent = Tables<'lesson_contents'>
export type Topic = Tables<'topics'>
export type LessonTopic = Tables<'lesson_topics'>

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

/**
 * The public syllabus: a lesson as it appears before anyone has paid.
 *
 * The body is deliberately not part of this type. Keeping the paid content out
 * of the shape the catalogue renders means a syllabus page cannot leak it by
 * accident — there is no field to forget to strip, and the database would not
 * return one anyway.
 */
export type SyllabusLesson = Pick<
  Lesson,
  'id' | 'title' | 'slug' | 'summary' | 'position' | 'estimated_minutes'
>

/** A module with its lessons in order — one section of a course outline. */
export type SyllabusModule = Pick<
  Module,
  'id' | 'title' | 'description' | 'position'
> & {
  lessons: SyllabusLesson[]
}

/** A whole course outline: what a visitor sees on the course page. */
export type CourseOutline = {
  course: Course
  modules: SyllabusModule[]
  /** Total estimated study time, or null when no lesson carries an estimate. */
  estimatedMinutes: number | null
  lessonCount: number
}

/**
 * A lesson opened by an enrolled student: metadata, body, and enough context
 * to render the previous/next controls.
 */
export type LessonWithContent = SyllabusLesson & {
  moduleId: string
  moduleTitle: string
  courseId: string
  courseSlug: string
  courseTitle: string
  body: string
  topics: Pick<Topic, 'id' | 'code' | 'name'>[]
}

/** A blueprint topic with its child topics, for the exam-blueprint view. */
export type TopicTree = Pick<
  Topic,
  'id' | 'code' | 'name' | 'blueprint_weight' | 'position'
> & {
  children: Pick<Topic, 'id' | 'code' | 'name' | 'blueprint_weight' | 'position'>[]
}

/** Human-readable study time, e.g. "1 hr 25 min". Null when unknown. */
export function formatStudyTime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} hr`
  return `${hours} hr ${rest} min`
}

const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
}

export function contentStatusLabel(status: ContentStatus): string {
  return CONTENT_STATUS_LABELS[status]
}
