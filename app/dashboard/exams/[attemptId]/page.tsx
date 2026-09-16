import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPaper } from '@/lib/attempts'
import { readinessBand } from '@/lib/readiness'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { ExamClient } from './ExamClient'

export const metadata: Metadata = { title: 'Exam' }

type Params = { params: Promise<{ attemptId: string }> }

/**
 * Sitting a paper, and reading the result.
 *
 * One page for both states, because they are the same paper — what changes is
 * whether the database has released the marks. `getPaper` withholds every
 * explanation until the reveal is allowed, so the "sitting" state has nothing
 * extra in its payload for a curious student to find.
 *
 * A paper belonging to somebody else comes back null, exactly as a paper that
 * does not exist does, and both become a 404. Telling them apart would let an
 * attempt id be tested for existence.
 */
export default async function ExamPage({ params }: Params) {
  await requireAuth()
  const { attemptId } = await params

  const { data: paper, error } = await getPaper(attemptId)

  if (error) {
    return (
      <>
        <PageHeader title="Exam" />
        <Alert variant="error">{error}</Alert>
      </>
    )
  }
  if (!paper) notFound()

  const submitted = paper.submittedAt !== null
  const score =
    submitted && paper.correctCount !== null && paper.questionCount > 0
      ? Math.round((paper.correctCount / paper.questionCount) * 100)
      : null

  return (
    <>
      <PageHeader
        title={submitted ? 'Your result' : 'Exam in progress'}
        description={
          submitted
            ? undefined
            : 'Your answers save as you go. You can leave and come back.'
        }
      />

      {submitted && score !== null && (
        <Card>
          <CardBody>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {paper.correctCount} of {paper.questionCount}
              <span className="ml-2 text-xl font-normal text-slate-600 dark:text-slate-400">
                ({score}%)
              </span>
            </p>
            {paper.kind === 'mock' && (
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                {readinessBand(score).label}
              </p>
            )}
            {paper.kind === 'mock' && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {readinessBand(score).advice}
              </p>
            )}
            {/*
              Said plainly, and deliberately, on every mock result. Texas
              publishes no pass mark -- the reported score is an equated
              scaled score and the cut score is not disclosed -- so any
              sentence implying "this means you would pass" would be a claim
              we cannot support. See docs/exam-facts.md.
            */}
            {paper.kind === 'mock' && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                This is your score on our material. Texas does not publish a
                pass mark for the state exam, so no practice score can predict
                one.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="mt-6">
        <ExamClient
          attemptId={paper.attemptId}
          kind={paper.kind}
          questions={paper.questions}
          submitted={submitted}
        />
      </div>
    </>
  )
}
