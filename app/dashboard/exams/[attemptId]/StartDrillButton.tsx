'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { startExam, type ExamActionState } from '../actions'

const INITIAL: ExamActionState = { error: null }

/**
 * Practise one weak topic.
 *
 * Offered only beside a topic scored under the ready threshold, because a
 * drill on a topic already at 90% is an hour that would have been better
 * spent elsewhere — and a results screen that offers every option equally
 * has not actually told the student anything.
 */
export function StartDrillButton({
  courseId,
  topicId,
  label,
}: {
  courseId: string
  topicId: string
  label: string
}) {
  const [state, action, pending] = useActionState(startExam, INITIAL)

  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="kind" value="drill" />
      <input type="hidden" name="topicId" value={topicId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Drawing…' : label}
      </Button>
      {state.error && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{state.error}</p>
      )}
    </form>
  )
}
