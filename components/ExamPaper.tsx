'use client'

/**
 * The paper a student sits, and the results they see afterwards.
 *
 * WHAT IS NOT IN THIS COMPONENT
 *
 * The answer key. Not in a prop, not in a data attribute, not in a hidden
 * field. `PaperQuestion.isCorrect` is null until `score_attempt()` writes it
 * in the database, and `explanation` is null until the reveal is allowed —
 * both decided server-side, in `lib/attempts.ts`, before this file is
 * rendered. There is nothing here to read in devtools because there is
 * nothing here to read.
 *
 * That is why the component takes a "revealed" paper and a "live" paper
 * through the same props: the difference between them is what the server
 * chose to send, not what this file chooses to show.
 */

import { useState } from 'react'
import Link from 'next/link'
import type { PaperQuestion } from '@/lib/attempts'
import type { AttemptKind } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

type Props = {
  attemptId: string
  kind: AttemptKind
  questions: PaperQuestion[]
  submitted: boolean
  onAnswer: (questionId: string, optionId: string) => void
  onSubmit: () => void
  saving: boolean
  error: string | null
}

const KIND_LABEL: Record<AttemptKind, string> = {
  quiz: 'Lesson quiz',
  module: 'Module test',
  mock: 'Practice exam',
  drill: 'Topic drill',
}

export function ExamPaper({
  attemptId,
  kind,
  questions,
  submitted,
  onAnswer,
  onSubmit,
  saving,
  error,
}: Props) {
  const [index, setIndex] = useState(0)
  const current = questions[index]
  const answered = questions.filter((q) => q.selectedOptionId !== null).length

  if (!current) {
    return (
      <Alert variant="warning">
        This paper has no questions. That should not happen — please tell us.
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {KIND_LABEL[kind]} · question {index + 1} of {questions.length}
        </p>
        {!submitted && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {answered} of {questions.length} answered
          </p>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardBody>
          <fieldset>
            <legend className="text-lg font-medium text-slate-900 dark:text-slate-100">
              {current.stem}
            </legend>

            <div className="mt-4 space-y-2">
              {current.options.map((option) => {
                const chosen = current.selectedOptionId === option.id
                return (
                  <label
                    key={option.id}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                      chosen
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                        : 'border-slate-200 dark:border-slate-700',
                      submitted ? 'cursor-default' : 'hover:border-slate-400',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name={`q-${current.questionId}`}
                      value={option.id}
                      checked={chosen}
                      disabled={submitted || saving}
                      onChange={() => onAnswer(current.questionId, option.id)}
                      className="mt-0.5"
                    />
                    <span>{option.body}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Shown only once the server has sent it — see the file header. */}
          {submitted && current.isCorrect !== null && (
            <div className="mt-4 space-y-2">
              <p
                className={
                  current.isCorrect
                    ? 'text-sm font-medium text-emerald-700 dark:text-emerald-400'
                    : 'text-sm font-medium text-rose-700 dark:text-rose-400'
                }
              >
                {current.isCorrect ? 'Correct' : 'Not correct'}
              </p>
              {current.explanation && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {current.explanation}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={index === questions.length - 1}
          >
            Next
          </Button>
        </div>

        {submitted ? (
          <Link
            href="/dashboard/exams"
            className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
          >
            Back to exams
          </Link>
        ) : (
          <Button type="button" onClick={onSubmit} disabled={saving}>
            {answered < questions.length
              ? `Submit (${questions.length - answered} unanswered)`
              : 'Submit'}
          </Button>
        )}
      </div>

      {!submitted && answered < questions.length && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Unanswered questions are marked wrong, not skipped — the same as the
          state exam.
        </p>
      )}

      <input type="hidden" name="attemptId" value={attemptId} />
    </div>
  )
}
