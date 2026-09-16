'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { startExam, type ExamActionState } from '@/app/dashboard/exams/actions'

const INITIAL: ExamActionState = { error: null }

type Props = {
  courseId: string
  /** Exactly one of these. The database refuses an attempt carrying both. */
  lessonId?: string
  moduleId?: string
  label: string
  hint?: string
}

/**
 * "Test yourself on what you just read."
 *
 * Placed at the END of a lesson and of a module, not the start, because a
 * quiz taken before reading measures what somebody already knew, and the
 * point of the testing effect is retrieval after learning.
 *
 * A lesson quiz reveals each answer immediately — it is a check, and the
 * explanation is the teaching. A module test does not; the database forces it
 * to `on_submit`, because a test walked through answer by answer measures
 * nothing.
 */
export function StartQuizButton({ courseId, lessonId, moduleId, label, hint }: Props) {
  const [state, action, pending] = useActionState(startExam, INITIAL)
  const kind = moduleId ? 'module' : 'quiz'

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="kind" value={kind} />
      {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}
      {moduleId && <input type="hidden" name="moduleId" value={moduleId} />}
      <Button type="submit" disabled={pending}>
        {pending ? 'Drawing your questions…' : label}
      </Button>
      {hint && !state.error && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{hint}</p>
      )}
      {state.error && <Alert variant="warning">{state.error}</Alert>}
    </form>
  )
}
