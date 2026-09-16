'use client'

/**
 * Client shell around ExamPaper: holds the answers the student has given so
 * the UI responds immediately, and persists each one through a server action.
 *
 * The optimistic state is a rendering convenience and nothing more. It is
 * never read back as truth — the score comes from `score_attempt()`, and on
 * submit the page re-renders from the database. If this state and the
 * database ever disagreed, the database wins and the student sees it.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExamPaper } from '@/components/ExamPaper'
import { ExamTimer } from '@/components/ExamTimer'
import { EXAM } from '@/lib/exam-facts'
import type { PaperQuestion } from '@/lib/attempts'
import type { AttemptKind } from '@/types'
import { answerQuestion, submitExam } from '../actions'

type Props = {
  attemptId: string
  kind: AttemptKind
  questions: PaperQuestion[]
  submitted: boolean
  startedAt: string
}

export function ExamClient({
  attemptId,
  kind,
  questions,
  submitted,
  startedAt,
}: Props) {
  const [local, setLocal] = useState(questions)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onAnswer(questionId: string, optionId: string) {
    setLocal((qs) =>
      qs.map((q) =>
        q.questionId === questionId ? { ...q, selectedOptionId: optionId } : q,
      ),
    )
    setError(null)

    const body = new FormData()
    body.set('attemptId', attemptId)
    body.set('questionId', questionId)
    body.set('optionId', optionId)

    startTransition(async () => {
      const result = await answerQuestion({ error: null }, body)
      if (result.error) setError(result.error)
    })
  }

  function onSubmit() {
    setError(null)
    const body = new FormData()
    body.set('attemptId', attemptId)

    startTransition(async () => {
      const result = await submitExam({ error: null }, body)
      // submitExam redirects on success, so reaching here means it failed.
      if (result?.error) setError(result.error)
      else router.refresh()
    })
  }

  // The clock runs on a mock only. A lesson quiz under time pressure would
  // measure composure rather than comprehension, which is not what it is for.
  const timed = kind === 'mock' && !submitted

  return (
    <div className="space-y-4">
      {timed && (
        <div className="flex justify-end">
          <ExamTimer
            startedAt={startedAt}
            limitMinutes={EXAM.minutes}
            onExpire={onSubmit}
          />
        </div>
      )}
      <ExamPaper
        attemptId={attemptId}
        kind={kind}
        questions={local}
        submitted={submitted}
        onAnswer={onAnswer}
        onSubmit={onSubmit}
        saving={pending}
        error={error}
      />
    </div>
  )
}
