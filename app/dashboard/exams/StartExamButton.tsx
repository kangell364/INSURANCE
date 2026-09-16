'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { startExam, type ExamActionState } from './actions'

const INITIAL: ExamActionState = { error: null }

/**
 * Starts a full practice exam.
 *
 * The only paper that can be started from here is a mock. Lesson quizzes and
 * module tests are started from the lesson and module they belong to, where
 * the student has the context to know what they are being tested on.
 */
export function StartExamButton({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(startExam, INITIAL)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="kind" value="mock" />
      <Button type="submit" disabled={pending}>
        {pending ? 'Drawing your paper…' : 'Start a full practice exam'}
      </Button>
      {state.error && <Alert variant="warning">{state.error}</Alert>}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        130 questions, weighted to the state blueprint. Your answers save as you
        go, so you can stop and come back.
      </p>
    </form>
  )
}
