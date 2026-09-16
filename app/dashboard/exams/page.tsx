import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getMyEnrollments } from '@/lib/queries'
import { getMyAttempts, getReadiness } from '@/lib/attempts'
import { readinessBand, READY_THRESHOLD } from '@/lib/readiness'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/States'
import { StartExamButton } from './StartExamButton'

export const metadata: Metadata = { title: 'Practice exams' }

const KIND_LABEL: Record<string, string> = {
  quiz: 'Lesson quiz',
  module: 'Module test',
  mock: 'Practice exam',
  drill: 'Topic drill',
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * The exams home: start a paper, resume an unfinished one, read your history.
 *
 * Readiness is shown only when a mock has actually been sat. A student with no
 * mocks is UNMEASURED, not unready, and showing them 0% would be both wrong
 * and discouraging.
 */
export default async function ExamsPage() {
  const { user } = await requireAuth()

  const { data: enrollments, error } = await getMyEnrollments(user.id)

  if (error) {
    return (
      <>
        <PageHeader title="Practice exams" />
        <Alert variant="error">{error}</Alert>
      </>
    )
  }

  const live = (enrollments ?? []).filter((e) => e.course !== null)

  if (live.length === 0) {
    return (
      <>
        <PageHeader title="Practice exams" />
        <EmptyState
          title="No course yet"
          description="Practice exams open up once you are enrolled on a course."
        />
      </>
    )
  }

  const course = live[0].course!
  const [{ data: attempts }, { data: readiness }] = await Promise.all([
    getMyAttempts(course.id),
    getReadiness(course.id),
  ])

  const unfinished = (attempts ?? []).filter((a) => a.submittedAt === null)
  const finished = (attempts ?? []).filter((a) => a.submittedAt !== null)

  return (
    <>
      <PageHeader
        title="Practice exams"
        description={`A full paper follows the state blueprint: 130 questions, weighted the way the real form is.`}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Readiness" />
          <CardBody>
            {readiness ? (
              <>
                <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
                  {readiness.scorePercent}%
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {readinessBand(readiness.scorePercent).label}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {readinessBand(readiness.scorePercent).advice}
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                  Averaged over your {readiness.fromAttempts} most recent
                  practice {readiness.fromAttempts === 1 ? 'exam' : 'exams'}.
                  Our bar is {READY_THRESHOLD}% on our own material — Texas does
                  not publish a pass mark for the state exam.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Not measured yet. Sit a full practice exam and your readiness
                appears here.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Start a paper" />
          <CardBody>
            <StartExamButton courseId={course.id} />
          </CardBody>
        </Card>

        {unfinished.length > 0 && (
          <Card>
            <CardHeader title="Unfinished" />
            <CardBody>
              <ul className="space-y-2">
                {unfinished.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link
                      href={`/dashboard/exams/${a.id}`}
                      className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </Link>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      started {formatWhen(a.startedAt)} · {a.questionCount}{' '}
                      questions
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="History" />
          <CardBody>
            {finished.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nothing yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {finished.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link
                      href={`/dashboard/exams/${a.id}`}
                      className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </Link>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatWhen(a.submittedAt!)} · {a.correctCount}/
                      {a.questionCount} ({a.scorePercent}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
