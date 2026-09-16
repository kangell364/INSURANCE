'use server'

/**
 * Exam actions.
 *
 * THE SECURITY POSTURE, as in the content actions: every call goes through
 * the ordinary anon-key client carrying the caller's session, and none of
 * them use a service-role key. The `requireAuth()` each one opens with buys a
 * clean error message; the thing that actually stops abuse is in the
 * database.
 *
 * Specifically: a student holds no `insert` on `attempts` or
 * `attempt_questions`, so `startExam` cannot assemble a paper here even if
 * this file wanted to — it asks `start_attempt()` to do it. And
 * `submitExam` cannot compute a score here, because nobody may read
 * `question_answers`; it asks `score_attempt()`. If every guard below were
 * deleted, a student calling these directly would still get a paper drawn by
 * the blueprint and a score they did not choose.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { startAttempt, saveAnswer, submitAttempt } from '@/lib/attempts'
import type { AttemptKind } from '@/types'

export type ExamActionState = { error: string | null }

/**
 * Draw a paper and go and sit it.
 *
 * The redirect is outside the try/catch that Next's `redirect()` would
 * otherwise be caught by — it throws a control-flow signal, not an error.
 */
export async function startExam(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  await requireAuth()

  const kind = String(formData.get('kind') ?? '') as AttemptKind
  const courseId = String(formData.get('courseId') ?? '')
  if (!courseId || !kind) return { error: 'Something was missing from that request.' }

  const lessonId = formData.get('lessonId')
  const moduleId = formData.get('moduleId')
  const topicId = formData.get('topicId')

  const { data, error } = await startAttempt({
    courseId,
    kind,
    lessonId: lessonId ? String(lessonId) : undefined,
    moduleId: moduleId ? String(moduleId) : undefined,
    topicId: topicId ? String(topicId) : undefined,
  })

  if (error || !data) return { error: error ?? 'We could not start that exam.' }

  redirect(`/dashboard/exams/${data}`)
}

/**
 * Record one answer.
 *
 * Returns rather than redirects, so the exam screen can save as the student
 * moves without losing their place. A save that matches no rows — because the
 * paper was already submitted — is not an error worth showing: the answer
 * genuinely cannot be recorded, and the results are already on screen.
 */
export async function answerQuestion(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  await requireAuth()

  const attemptId = String(formData.get('attemptId') ?? '')
  const questionId = String(formData.get('questionId') ?? '')
  const optionId = String(formData.get('optionId') ?? '')
  if (!attemptId || !questionId || !optionId) {
    return { error: 'Something was missing from that answer.' }
  }

  const { error } = await saveAnswer(attemptId, questionId, optionId)
  if (error) return { error }

  revalidatePath(`/dashboard/exams/${attemptId}`)
  return { error: null }
}

/** Submit, score, and show the results. */
export async function submitExam(
  _prev: ExamActionState,
  formData: FormData,
): Promise<ExamActionState> {
  await requireAuth()

  const attemptId = String(formData.get('attemptId') ?? '')
  if (!attemptId) return { error: 'Something was missing from that request.' }

  const { error } = await submitAttempt(attemptId)
  if (error) return { error }

  revalidatePath(`/dashboard/exams/${attemptId}`)
  redirect(`/dashboard/exams/${attemptId}`)
}
