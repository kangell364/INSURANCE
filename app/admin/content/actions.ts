'use server'

/**
 * Content authoring actions.
 *
 * THE SECURITY POSTURE, stated once and relied on throughout:
 *
 * Every action below goes through `createClient()` — the ordinary
 * anon-key client carrying the caller's session. **None of them use the
 * service-role key.** That matters more than the `assertAdmin()` guard each
 * one opens with: the guard produces a clean error message, but the thing
 * that actually stops a non-admin writing content is the RLS policy on each
 * table, evaluated in the database, on every statement. If every guard in
 * this file were deleted, a student calling these actions directly would
 * still write nothing — their UPDATE would match zero rows and their INSERT
 * would be rejected by the policy's WITH CHECK.
 *
 * The guard exists so an admin whose session expired gets "please sign in
 * again" instead of a silent no-op. It is a usability feature standing in
 * front of the real control, and it is worth being clear about which is
 * which.
 *
 * Nothing here trusts `course_id` from the form either. It is read back from
 * the parent row the database already holds, so a tampered field cannot move
 * a lesson into another course — and the composite foreign keys would reject
 * it even if it could.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthContext } from '@/lib/auth'
import {
  hasErrors,
  validateLesson,
  validateModule,
  validateTopic,
  type FieldErrors,
  type LessonFields,
  type ModuleFields,
  type TopicFields,
} from '@/lib/validation'
import type { ActionState } from '@/lib/action-state'
import type { ContentStatus } from '@/types'

function failure<T extends string>(
  message: string,
  fieldErrors: FieldErrors<T> = {},
): ActionState<T> {
  return { status: 'error', message, fieldErrors }
}

const SESSION_EXPIRED =
  'Your session has expired or your account is no longer an administrator. ' +
  'Please sign in again.'

const SAVE_FAILED = 'We could not save that change. Please try again.'

/** Resolves the caller, or null when they are not a signed-in admin. */
async function assertAdmin(): Promise<{ userId: string } | null> {
  const context = await getAuthContext()
  if (!context || context.profile?.role !== 'admin') return null
  return { userId: context.user.id }
}

function logFailure(scope: string, error: { code?: string; message: string }) {
  console.error(`[admin:${scope}] failed`, {
    code: error.code,
    message: error.message,
  })
}

/**
 * Refreshes every page a content change can appear on.
 *
 * Deliberately broad. A lesson edit changes the authoring screens, the
 * student reader, the student course page and the public syllabus — and the
 * public syllabus is the one most likely to be forgotten, because the person
 * editing is looking at the admin screen and never sees it go stale.
 */
function revalidateContent(courseSlug: string) {
  revalidatePath('/admin/content', 'layout')
  revalidatePath(`/courses/${courseSlug}`)
  revalidatePath('/courses')
  revalidatePath(`/dashboard/courses/${courseSlug}`, 'layout')
}

function readStatus(formData: FormData): ContentStatus {
  const value = String(formData.get('status') ?? 'draft')
  return value === 'active' || value === 'archived' ? value : 'draft'
}

/** The next free position in a set, so authors never type one by hand. */
async function nextPosition(
  table: 'modules' | 'lessons' | 'topics',
  column: string,
  parentId: string,
): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from(table)
    .select('position')
    .eq(column, parentId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.position ?? 0) + 1
}

/* --------------------------------------------------------------------------
   Modules
   -------------------------------------------------------------------------- */

export async function saveModuleAction(
  _previous: ActionState<ModuleFields>,
  formData: FormData,
): Promise<ActionState<ModuleFields>> {
  if (!(await assertAdmin())) return failure(SESSION_EXPIRED)

  const moduleId = String(formData.get('moduleId') ?? '')
  const courseId = String(formData.get('courseId') ?? '')
  const courseSlug = String(formData.get('courseSlug') ?? '')
  const title = String(formData.get('title') ?? '')
  const description = String(formData.get('description') ?? '')

  const fieldErrors = validateModule({ title, description })
  if (hasErrors(fieldErrors)) {
    return failure('Please correct the highlighted fields.', fieldErrors)
  }

  const supabase = await createClient()
  const values = {
    title: title.trim(),
    description: description.trim() || null,
    status: readStatus(formData),
  }

  if (moduleId) {
    const { error } = await supabase
      .from('modules')
      .update(values)
      .eq('id', moduleId)
    if (error) {
      logFailure('module.update', error)
      return failure(SAVE_FAILED)
    }
  } else {
    if (!courseId) return failure(SAVE_FAILED)
    const { error } = await supabase.from('modules').insert({
      ...values,
      course_id: courseId,
      position: await nextPosition('modules', 'course_id', courseId),
    })
    if (error) {
      logFailure('module.insert', error)
      return failure(SAVE_FAILED)
    }
  }

  revalidateContent(courseSlug)
  redirect(`/admin/content/${courseSlug}`)
}

/* --------------------------------------------------------------------------
   Lessons
   -------------------------------------------------------------------------- */

export async function saveLessonAction(
  _previous: ActionState<LessonFields>,
  formData: FormData,
): Promise<ActionState<LessonFields>> {
  if (!(await assertAdmin())) return failure(SESSION_EXPIRED)

  const lessonId = String(formData.get('lessonId') ?? '')
  const moduleId = String(formData.get('moduleId') ?? '')
  const courseSlug = String(formData.get('courseSlug') ?? '')
  const title = String(formData.get('title') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const summary = String(formData.get('summary') ?? '')
  const estimatedMinutes = String(formData.get('estimatedMinutes') ?? '')
  const body = String(formData.get('body') ?? '')
  const topicIds = formData.getAll('topicIds').map(String).filter(Boolean)

  const fieldErrors = validateLesson({
    title,
    slug,
    summary,
    estimatedMinutes,
  })
  if (hasErrors(fieldErrors)) {
    return failure('Please correct the highlighted fields.', fieldErrors)
  }

  const supabase = await createClient()

  // course_id is read from the module row rather than taken from the form.
  // The composite foreign key would reject a mismatched value anyway; reading
  // it means the form never has to carry a field whose only correct value is
  // derivable.
  const { data: moduleRow, error: moduleError } = await supabase
    .from('modules')
    .select('id, course_id')
    .eq('id', moduleId)
    .maybeSingle()

  if (moduleError || !moduleRow) {
    if (moduleError) logFailure('lesson.module', moduleError)
    return failure('That module no longer exists.')
  }

  const values = {
    title: title.trim(),
    slug: slug.trim(),
    summary: summary.trim() || null,
    status: readStatus(formData),
    estimated_minutes: estimatedMinutes.trim()
      ? Number(estimatedMinutes.trim())
      : null,
  }

  let savedId = lessonId

  if (lessonId) {
    const { error } = await supabase
      .from('lessons')
      .update(values)
      .eq('id', lessonId)
    if (error) {
      logFailure('lesson.update', error)
      return failure(slugConflict(error) ?? SAVE_FAILED, slugFieldError(error))
    }
  } else {
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        ...values,
        module_id: moduleRow.id,
        course_id: moduleRow.course_id,
        position: await nextPosition('lessons', 'module_id', moduleRow.id),
      })
      .select('id')
      .single()
    if (error || !data) {
      if (error) logFailure('lesson.insert', error)
      return failure(
        slugConflict(error) ?? SAVE_FAILED,
        slugFieldError(error),
      )
    }
    savedId = data.id
  }

  // The body lives in its own table, and a lesson may legitimately have none
  // yet. Upsert rather than insert-or-update so the first save and every
  // later one take the same path.
  const { error: bodyError } = await supabase.from('lesson_contents').upsert(
    {
      lesson_id: savedId,
      course_id: moduleRow.course_id,
      body,
    },
    { onConflict: 'lesson_id' },
  )
  if (bodyError) {
    logFailure('lesson.body', bodyError)
    return failure('The lesson was saved but its content was not.')
  }

  // Tags are replaced wholesale: the form submits the complete set, so
  // reconciling additions and removals separately would be more code for the
  // same result.
  const { error: clearError } = await supabase
    .from('lesson_topics')
    .delete()
    .eq('lesson_id', savedId)
  if (clearError) logFailure('lesson.clearTopics', clearError)

  if (topicIds.length > 0) {
    const { error: tagError } = await supabase.from('lesson_topics').insert(
      topicIds.map((topicId) => ({
        lesson_id: savedId,
        topic_id: topicId,
        course_id: moduleRow.course_id,
      })),
    )
    if (tagError) logFailure('lesson.tag', tagError)
  }

  revalidateContent(courseSlug)
  redirect(`/admin/content/${courseSlug}`)
}

/**
 * Turns a unique-violation into something an author can act on.
 *
 * `23505` on lessons means the slug is already used in this module. Reporting
 * it as a generic save failure would leave the author retrying the same thing.
 */
function slugConflict(
  error: { code?: string } | null | undefined,
): string | null {
  return error?.code === '23505'
    ? 'Another lesson in this module already uses that web address.'
    : null
}

function slugFieldError(
  error: { code?: string } | null | undefined,
): FieldErrors<LessonFields> {
  return error?.code === '23505'
    ? { slug: 'Already used by another lesson in this module.' }
    : {}
}

/* --------------------------------------------------------------------------
   Topics
   -------------------------------------------------------------------------- */

export async function saveTopicAction(
  _previous: ActionState<TopicFields>,
  formData: FormData,
): Promise<ActionState<TopicFields>> {
  if (!(await assertAdmin())) return failure(SESSION_EXPIRED)

  const topicId = String(formData.get('topicId') ?? '')
  const courseId = String(formData.get('courseId') ?? '')
  const courseSlug = String(formData.get('courseSlug') ?? '')
  const parentTopicId = String(formData.get('parentTopicId') ?? '')
  const code = String(formData.get('code') ?? '')
  const name = String(formData.get('name') ?? '')
  const questionCount = String(formData.get('questionCount') ?? '')
  const blueprintWeight = String(formData.get('blueprintWeight') ?? '')

  const fieldErrors = validateTopic({
    code,
    name,
    questionCount,
    blueprintWeight,
  })
  if (hasErrors(fieldErrors)) {
    return failure('Please correct the highlighted fields.', fieldErrors)
  }

  const supabase = await createClient()
  const values = {
    code: code.trim(),
    name: name.trim(),
    parent_topic_id: parentTopicId || null,
    question_count: questionCount.trim() ? Number(questionCount.trim()) : null,
    blueprint_weight: blueprintWeight.trim()
      ? Number(blueprintWeight.trim())
      : null,
  }

  if (topicId) {
    const { error } = await supabase
      .from('topics')
      .update(values)
      .eq('id', topicId)
    if (error) {
      logFailure('topic.update', error)
      return failure(topicErrorMessage(error))
    }
  } else {
    if (!courseId) return failure(SAVE_FAILED)
    const { error } = await supabase.from('topics').insert({
      ...values,
      course_id: courseId,
      position: await nextPosition('topics', 'course_id', courseId),
    })
    if (error) {
      logFailure('topic.insert', error)
      return failure(topicErrorMessage(error))
    }
  }

  revalidateContent(courseSlug)
  redirect(`/admin/content/${courseSlug}/topics`)
}

/**
 * Explains the two database rules an author can realistically hit.
 *
 * `23514` from the depth trigger and `23505` from the per-course code
 * uniqueness are both things the person typing can fix; everything else is
 * ours to investigate and is reported generically.
 */
function topicErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === '23505') {
    return 'Another topic in this course already uses that code.'
  }
  if (error.code === '23514' && error.message?.includes('nest one level')) {
    return 'Topics can only be nested one level deep. Choose a top-level topic as the parent, or none.'
  }
  if (error.code === '23514') {
    return 'That value is outside the range the database allows.'
  }
  if (error.code === '23503') {
    return 'That topic still has sub-topics, or is still in use.'
  }
  return SAVE_FAILED
}

/* --------------------------------------------------------------------------
   Ordering and lifecycle
   -------------------------------------------------------------------------- */

/**
 * Swaps a module or lesson with its neighbour.
 *
 * Two UPDATEs that momentarily give two rows the same position. That is
 * exactly why `modules_course_position_key` and `lessons_module_position_key`
 * are DEFERRABLE — see the migrations. Without deferral this needs a sentinel
 * position and three statements, and leaves debris if it dies halfway.
 *
 * Supabase's REST API cannot issue `SET CONSTRAINTS`, so the two updates are
 * sent separately and the window where both rows share a position is real but
 * sub-second. The constraint still refuses a permanent duplicate, which is
 * what it is for. Moving this into a `SECURITY INVOKER` RPC that does both
 * inside one deferred transaction is the correct fix and is noted in
 * docs/phase-2-design.md rather than done here, because it needs a migration
 * and this needs to work today.
 */
export async function moveContentAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return

  const kind = String(formData.get('kind') ?? '')
  const id = String(formData.get('id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const courseSlug = String(formData.get('courseSlug') ?? '')

  if (kind !== 'module' && kind !== 'lesson') return
  if (direction !== 'up' && direction !== 'down') return

  // The two branches are written out rather than computed from `kind`.
  //
  // A single parameterised version needs the table and the parent column as
  // variables, and Supabase's generated types cannot follow that: the query
  // builder resolves column names against a literal table name, so a computed
  // one degrades every result to an error type. Casting past it would discard
  // exactly the checking that makes these queries safe to write, to save a
  // dozen lines. The duplication is the cheaper of the two.
  const supabase = await createClient()

  if (kind === 'module') {
    const { data: current } = await supabase
      .from('modules')
      .select('id, position, course_id')
      .eq('id', id)
      .maybeSingle()
    if (!current) return

    const query = supabase
      .from('modules')
      .select('id, position')
      .eq('course_id', current.course_id)
    const { data: neighbour } =
      direction === 'up'
        ? await query
            .lt('position', current.position)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle()
        : await query
            .gt('position', current.position)
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle()

    // Already at the end. Not an error — the control is simply a no-op there.
    if (!neighbour) return

    await supabase
      .from('modules')
      .update({ position: neighbour.position })
      .eq('id', current.id)
    await supabase
      .from('modules')
      .update({ position: current.position })
      .eq('id', neighbour.id)
  } else {
    const { data: current } = await supabase
      .from('lessons')
      .select('id, position, module_id')
      .eq('id', id)
      .maybeSingle()
    if (!current) return

    const query = supabase
      .from('lessons')
      .select('id, position')
      .eq('module_id', current.module_id)
    const { data: neighbour } =
      direction === 'up'
        ? await query
            .lt('position', current.position)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle()
        : await query
            .gt('position', current.position)
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle()

    if (!neighbour) return

    await supabase
      .from('lessons')
      .update({ position: neighbour.position })
      .eq('id', current.id)
    await supabase
      .from('lessons')
      .update({ position: current.position })
      .eq('id', neighbour.id)
  }

  revalidateContent(courseSlug)
}

/** Publishes or unpublishes a module or lesson. */
export async function setStatusAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return

  const kind = String(formData.get('kind') ?? '')
  const id = String(formData.get('id') ?? '')
  const status = readStatus(formData)
  const courseSlug = String(formData.get('courseSlug') ?? '')

  if (kind !== 'module' && kind !== 'lesson') return

  const supabase = await createClient()
  const { error } = await supabase
    .from(kind === 'module' ? 'modules' : 'lessons')
    .update({ status })
    .eq('id', id)

  if (error) logFailure(`${kind}.setStatus`, error)
  revalidateContent(courseSlug)
}

/**
 * Deletes a module or lesson.
 *
 * `on delete cascade` takes the lessons and bodies with a module, which is
 * why the confirmation in the UI names how many lessons will go. There is no
 * undo; the alternative to a clear warning is a support request.
 */
export async function deleteContentAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return

  const kind = String(formData.get('kind') ?? '')
  const id = String(formData.get('id') ?? '')
  const courseSlug = String(formData.get('courseSlug') ?? '')

  if (kind !== 'module' && kind !== 'lesson') return

  const supabase = await createClient()
  const { error } = await supabase
    .from(kind === 'module' ? 'modules' : 'lessons')
    .delete()
    .eq('id', id)

  if (error) logFailure(`${kind}.delete`, error)
  revalidateContent(courseSlug)
  redirect(`/admin/content/${courseSlug}`)
}
