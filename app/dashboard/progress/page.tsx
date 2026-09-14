import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/States'
import { ProgressBar } from '@/components/ui/Progress'

export const metadata: Metadata = { title: 'Progress' }

/**
 * Phase 1 renders the shape of the progress report with no invented data.
 *
 * Real figures need the scoring engine and the tagged question bank, which are
 * later phases. Showing plausible-looking percentages now would be worse than
 * showing nothing: a candidate could book an exam on the strength of a number
 * that means nothing.
 */
export default async function ProgressPage() {
  await requireAuth()

  return (
    <>
      <PageHeader
        title="Progress"
        description="Topic-level mastery across your enrolled courses."
      />

      <div className="mb-6">
        <Alert variant="info" title="Not yet measuring">
          Progress tracking activates once lessons and quizzes are released.
          Nothing is being recorded against your account yet, so this page has
          no results to show.
        </Alert>
      </div>

      <Card>
        <CardHeader
          title="Overall readiness"
          description="Calculated from scored quiz and practice-exam results."
        />
        <CardBody>
          <ProgressBar label="Exam readiness" value={0} hasData={false} />
          <p className="mt-4 text-sm text-slate-500">
            Your readiness score will combine topic mastery, practice-exam
            results and how recently you studied each area.
          </p>
        </CardBody>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader title="By topic" />
          <EmptyState
            title="No topic results yet"
            description="Each exam topic will appear here with its own mastery score as soon as you start completing quizzes."
            action={
              <ButtonLink href="/dashboard/courses" variant="secondary">
                Go to my courses
              </ButtonLink>
            }
          />
        </Card>
      </div>
    </>
  )
}
