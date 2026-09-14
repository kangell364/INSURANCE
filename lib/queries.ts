import 'server-only'

/**
 * Server-side data access for Phase 1.
 *
 * Every function here goes through the RLS-governed anon-key client, so the
 * database — not this file — is what actually decides which rows come back.
 * The filters below are for correctness and index use, not for security: if a
 * filter were removed, RLS would still return only the caller's own rows.
 *
 * Errors are logged with enough detail for an operator and returned as a short
 * human-readable string. Raw Postgres messages are never handed to the UI.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import type { Course, EnrollmentWithCourse } from '@/types'

export type QueryResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

const GENERIC_ERROR =
  'We could not load this information right now. Please try again shortly.'

const NOT_CONFIGURED =
  'The application is not connected to its database yet. Set ' +
  'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.'

function logFailure(scope: string, error: PostgrestError): void {
  // Codes and hints only — never the anon key, never a full connection string.
  console.error(`[data:${scope}] query failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
  })
}

/**
 * The public course catalogue.
 *
 * Returns only active courses. RLS enforces the same thing independently, so
 * a draft course cannot leak even if this filter is edited away.
 */
export async function getActiveCourses(): Promise<QueryResult<Course[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug, description, status, created_at, updated_at')
    .eq('status', 'active')
    .order('title', { ascending: true })

  if (error) {
    logFailure('courses.active', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: data ?? [], error: null }
}

/**
 * The signed-in student's enrollments, with the course each one points at.
 *
 * `student_id` is taken from the verified session, never from a parameter the
 * client could tamper with — and RLS would reject another student's id anyway.
 */
export async function getMyEnrollments(
  studentId: string,
): Promise<QueryResult<EnrollmentWithCourse[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `id, student_id, course_id, status, enrolled_at, expires_at,
       course:courses ( id, title, slug, description, status )`,
    )
    .eq('student_id', studentId)
    .order('enrolled_at', { ascending: false })

  if (error) {
    logFailure('enrollments.mine', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: (data ?? []) as EnrollmentWithCourse[], error: null }
}

/** Counts for the admin shell. Admin-only rows are enforced by RLS. */
export async function getAdminCounts(): Promise<
  QueryResult<{ students: number; courses: number; enrollments: number }>
> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()

  const [students, courses, enrollments] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student'),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }),
  ])

  const failure = students.error ?? courses.error ?? enrollments.error
  if (failure) {
    logFailure('admin.counts', failure)
    return { data: null, error: GENERIC_ERROR }
  }

  return {
    data: {
      students: students.count ?? 0,
      courses: courses.count ?? 0,
      enrollments: enrollments.count ?? 0,
    },
    error: null,
  }
}
