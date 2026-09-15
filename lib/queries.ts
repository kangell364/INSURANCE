import 'server-only'

/**
 * Server-side data access.
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
import type {
  Course,
  CourseOutline,
  Lesson,
  Module,
  EnrollmentWithCourse,
  LessonWithContent,
  SyllabusLesson,
  SyllabusModule,
  Topic,
  TopicTree,
} from '@/types'

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

/* ==========================================================================
   Phase 2 — course content.

   Two rules hold throughout:

   1. The SYLLABUS (module and lesson titles, ordering, study estimates) is
      public. It is read from `modules` and `lessons`, which anonymous
      visitors may select.

   2. The BODY is not. It is read from `lesson_contents`, which anonymous
      visitors hold no privilege on at all and which RLS releases only to a
      caller with a live enrollment. No function here checks enrollment
      itself — that is the database's job, and duplicating it in TypeScript
      would create a second answer that can disagree with the first.
   ========================================================================== */

/**
 * The public outline of one course: its modules, each with its lessons.
 *
 * Draft and archived content is absent because RLS removes it, not because of
 * a filter here. An admin calling this sees drafts too, which is what the
 * admin content screens want.
 */
export async function getCourseOutline(
  slug: string,
): Promise<QueryResult<CourseOutline | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, description, status, created_at, updated_at')
    .eq('slug', slug)
    .maybeSingle()

  if (courseError) {
    logFailure('courses.bySlug', courseError)
    return { data: null, error: GENERIC_ERROR }
  }
  if (!course) return { data: null, error: null }

  // One round trip for modules and their lessons. PostgREST orders the
  // embedded rows when asked, so the UI never has to sort.
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(
      `id, title, description, position,
       lessons ( id, title, slug, summary, position, estimated_minutes )`,
    )
    .eq('course_id', course.id)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'lessons', ascending: true })

  if (modulesError) {
    logFailure('modules.byCourse', modulesError)
    return { data: null, error: GENERIC_ERROR }
  }

  const outlineModules: SyllabusModule[] = (modules ?? []).map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    position: module.position,
    lessons: (module.lessons ?? []) as SyllabusLesson[],
  }))

  const lessons = outlineModules.flatMap((module) => module.lessons)
  const totalMinutes = lessons.reduce(
    (sum, lesson) => sum + (lesson.estimated_minutes ?? 0),
    0,
  )

  return {
    data: {
      course,
      modules: outlineModules,
      // Null rather than 0 when nothing carries an estimate: "no estimate
      // recorded" and "this course takes no time" are different claims, and
      // the second one is never true.
      estimatedMinutes: totalMinutes > 0 ? totalMinutes : null,
      lessonCount: lessons.length,
    },
    error: null,
  }
}

/**
 * One lesson with its body, for a student who is entitled to read it.
 *
 * Returns `{ data: null, error: null }` in three different situations that the
 * caller must treat identically: the lesson does not exist, it is not
 * published, or the caller is not enrolled. Distinguishing them in the
 * response would turn this into an oracle that tells an unenrolled visitor
 * exactly which lesson slugs exist.
 *
 * The page layer decides what to show; see app/dashboard/courses/[...]/page.tsx,
 * which checks enrollment separately in order to offer the right call to
 * action, and does so without ever having had the body in hand.
 */
export async function getLessonWithContent(
  courseSlug: string,
  lessonSlug: string,
): Promise<QueryResult<LessonWithContent | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lessons')
    .select(
      `id, title, slug, summary, position, estimated_minutes,
       module_id, course_id,
       module:modules!inner ( id, title ),
       course:courses!inner ( id, slug, title ),
       content:lesson_contents ( body ),
       lesson_topics ( topic:topics ( id, code, name ) )`,
    )
    .eq('slug', lessonSlug)
    .eq('courses.slug', courseSlug)
    .maybeSingle()

  if (error) {
    logFailure('lessons.withContent', error)
    return { data: null, error: GENERIC_ERROR }
  }
  if (!data) return { data: null, error: null }

  // The embed comes back empty when RLS withholds the body — an unenrolled
  // student gets the lesson row (it is public syllabus) with no content row.
  // That is the entitlement check, and it happened in the database.
  const content = Array.isArray(data.content) ? data.content[0] : data.content
  if (!content) return { data: null, error: null }

  // Named `moduleRow` rather than `module`: `module` is a CommonJS global and
  // Next's lint rules reject shadowing it.
  const moduleRow = Array.isArray(data.module) ? data.module[0] : data.module
  const course = Array.isArray(data.course) ? data.course[0] : data.course
  if (!moduleRow || !course) return { data: null, error: null }

  return {
    data: {
      id: data.id,
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      position: data.position,
      estimated_minutes: data.estimated_minutes,
      moduleId: moduleRow.id,
      moduleTitle: moduleRow.title,
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      body: content.body,
      topics: (data.lesson_topics ?? [])
        .map((row) => (Array.isArray(row.topic) ? row.topic[0] : row.topic))
        .filter((topic): topic is Topic => Boolean(topic))
        .map(({ id, code, name }) => ({ id, code, name })),
    },
    error: null,
  }
}

/**
 * The exam blueprint for a course, as a two-level tree.
 *
 * Public: the blueprint is a state publication, and "what is actually on the
 * Texas exam?" is the most useful page the site can offer someone who has not
 * bought anything yet.
 */
export async function getTopicTree(
  courseId: string,
): Promise<QueryResult<TopicTree[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('id, code, name, question_count, blueprint_weight, position, parent_topic_id')
    .eq('course_id', courseId)
    .order('position', { ascending: true })

  if (error) {
    logFailure('topics.byCourse', error)
    return { data: null, error: GENERIC_ERROR }
  }

  const rows = data ?? []
  const roots = rows.filter((row) => row.parent_topic_id === null)

  return {
    data: roots.map((root) => ({
      id: root.id,
      code: root.code,
      name: root.name,
      question_count: root.question_count,
      blueprint_weight: root.blueprint_weight,
      position: root.position,
      children: rows
        .filter((row) => row.parent_topic_id === root.id)
        .map(({ id, code, name, question_count, blueprint_weight, position }) => ({
          id,
          code,
          name,
          question_count,
          blueprint_weight,
          position,
        })),
    })),
    error: null,
  }
}

/** Counts for the admin content screens. Admin-only rows are enforced by RLS. */
export async function getContentCounts(): Promise<
  QueryResult<{ modules: number; lessons: number; topics: number }>
> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const [modules, lessons, topics] = await Promise.all([
    supabase.from('modules').select('id', { count: 'exact', head: true }),
    supabase.from('lessons').select('id', { count: 'exact', head: true }),
    supabase.from('topics').select('id', { count: 'exact', head: true }),
  ])

  const failure = modules.error ?? lessons.error ?? topics.error
  if (failure) {
    logFailure('admin.contentCounts', failure)
    return { data: null, error: GENERIC_ERROR }
  }

  return {
    data: {
      modules: modules.count ?? 0,
      lessons: lessons.count ?? 0,
      topics: topics.count ?? 0,
    },
    error: null,
  }
}

/**
 * The signed-in student's enrollment in one course, by course slug.
 *
 * Used by the lesson reader to choose the right message when the body is
 * withheld. It is safe to tell a student about their OWN enrollment state —
 * RLS returns only their rows — and it is the difference between "you need to
 * enrol" and "your access expired", which are different problems with
 * different fixes.
 */
export async function getMyEnrollmentForCourseSlug(
  studentId: string,
  courseSlug: string,
): Promise<QueryResult<EnrollmentWithCourse | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `id, student_id, course_id, status, enrolled_at, expires_at,
       course:courses!inner ( id, title, slug, description, status )`,
    )
    .eq('student_id', studentId)
    .eq('courses.slug', courseSlug)
    .maybeSingle()

  if (error) {
    logFailure('enrollments.byCourseSlug', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: (data as EnrollmentWithCourse | null) ?? null, error: null }
}

/**
 * Whether the signed-in user holds a live enrollment in a course.
 *
 * This calls the database function public.is_enrolled_in_course() rather than
 * reading the enrollment row and working it out here.
 *
 * The reason is that the same function is what the RLS policy on
 * lesson_contents consults. Reimplementing "active, and not past expires_at"
 * in TypeScript would create a second definition of entitlement that can drift
 * from the first — and the failure it drifts into is a page that offers a
 * student a lesson link the database then refuses to honour, or worse, one
 * that tells a paying student they are not enrolled. One definition, in one
 * place, consulted by both.
 *
 * Note this answers "may they read lesson bodies", not "do they have an
 * enrollment row". Use getMyEnrollmentForCourseSlug when the UI needs to
 * explain WHY access is not live.
 */
export async function hasLiveEnrollment(courseId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_enrolled_in_course', {
    p_course_id: courseId,
  })

  if (error) {
    logFailure('enrollments.isLive', error)
    // Fail closed. An unreadable entitlement is not an entitlement.
    return false
  }

  return data === true
}

/* ==========================================================================
   Admin content reads.

   These return DRAFTS as well as published rows. That is not a privilege this
   file grants: the same query run by a student returns only what the student
   may see, because every one of these goes through the RLS-governed client.
   The difference in what comes back is entirely the difference between the
   two callers' policies.
   ========================================================================== */

export type AdminLesson = Pick<
  Lesson,
  | 'id'
  | 'title'
  | 'slug'
  | 'summary'
  | 'position'
  | 'status'
  | 'estimated_minutes'
> & { hasBody: boolean }

export type AdminModule = Pick<
  Module,
  'id' | 'title' | 'description' | 'position' | 'status'
> & { lessons: AdminLesson[] }

export type AdminCourseContent = {
  course: Course
  modules: AdminModule[]
}

/**
 * The whole content tree for one course, drafts included.
 *
 * `hasBody` rather than the body itself: the authoring index needs to show
 * which lessons are still empty, and pulling every lesson body to answer a
 * yes/no question would move the entire course over the wire to render a
 * list. The body is fetched only by the editor that is about to show it.
 */
export async function getAdminCourseContent(
  courseSlug: string,
): Promise<QueryResult<AdminCourseContent | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, slug, description, status, created_at, updated_at')
    .eq('slug', courseSlug)
    .maybeSingle()

  if (courseError) {
    logFailure('admin.courseBySlug', courseError)
    return { data: null, error: GENERIC_ERROR }
  }
  if (!course) return { data: null, error: null }

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(
      `id, title, description, position, status,
       lessons ( id, title, slug, summary, position, status, estimated_minutes,
                 lesson_contents ( lesson_id ) )`,
    )
    .eq('course_id', course.id)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'lessons', ascending: true })

  if (modulesError) {
    logFailure('admin.modulesByCourse', modulesError)
    return { data: null, error: GENERIC_ERROR }
  }

  return {
    data: {
      course,
      modules: (modules ?? []).map((moduleRow) => ({
        id: moduleRow.id,
        title: moduleRow.title,
        description: moduleRow.description,
        position: moduleRow.position,
        status: moduleRow.status,
        lessons: (moduleRow.lessons ?? []).map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          summary: lesson.summary,
          position: lesson.position,
          status: lesson.status,
          estimated_minutes: lesson.estimated_minutes,
          // PostgREST returns a one-to-one embed as an object, not an
          // array, and the generated types reflect that. Both shapes are
          // handled because the relationship's cardinality is a property of
          // the schema that a future migration could change.
          hasBody: Array.isArray(lesson.lesson_contents)
            ? lesson.lesson_contents.length > 0
            : Boolean(lesson.lesson_contents),
        })),
      })),
    },
    error: null,
  }
}

export type LessonForEdit = Pick<
  Lesson,
  | 'id'
  | 'module_id'
  | 'course_id'
  | 'title'
  | 'slug'
  | 'summary'
  | 'position'
  | 'status'
  | 'estimated_minutes'
> & {
  body: string
  moduleTitle: string
  topicIds: string[]
}

/** One lesson with its body and topic tags, for the authoring form. */
export async function getLessonForEdit(
  lessonId: string,
): Promise<QueryResult<LessonForEdit | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lessons')
    .select(
      `id, module_id, course_id, title, slug, summary, position, status,
       estimated_minutes,
       module:modules!inner ( title ),
       content:lesson_contents ( body ),
       lesson_topics ( topic_id )`,
    )
    .eq('id', lessonId)
    .maybeSingle()

  if (error) {
    logFailure('admin.lessonForEdit', error)
    return { data: null, error: GENERIC_ERROR }
  }
  if (!data) return { data: null, error: null }

  const content = Array.isArray(data.content) ? data.content[0] : data.content
  const moduleRow = Array.isArray(data.module) ? data.module[0] : data.module

  return {
    data: {
      id: data.id,
      module_id: data.module_id,
      course_id: data.course_id,
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      position: data.position,
      status: data.status,
      estimated_minutes: data.estimated_minutes,
      // A lesson with no content row yet is normal: the row is created the
      // first time a body is saved.
      body: content?.body ?? '',
      moduleTitle: moduleRow?.title ?? '',
      topicIds: (data.lesson_topics ?? []).map((row) => row.topic_id),
    },
    error: null,
  }
}

export type AdminTopic = Pick<
  Topic,
  | 'id'
  | 'course_id'
  | 'parent_topic_id'
  | 'code'
  | 'name'
  | 'question_count'
  | 'blueprint_weight'
  | 'position'
>

/** Every topic for a course, flat and in order, for the topic screens. */
export async function getCourseTopics(
  courseId: string,
): Promise<QueryResult<AdminTopic[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('topics')
    .select('id, course_id, parent_topic_id, code, name, question_count, blueprint_weight, position')
    .eq('course_id', courseId)
    .order('position', { ascending: true })

  if (error) {
    logFailure('admin.courseTopics', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: data ?? [], error: null }
}

/** Every course, drafts included, for the admin content index. */
export async function getAllCourses(): Promise<QueryResult<Course[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug, description, status, created_at, updated_at')
    .order('title', { ascending: true })

  if (error) {
    logFailure('admin.allCourses', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: data ?? [], error: null }
}
