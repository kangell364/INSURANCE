import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getMyEnrollments } from '@/lib/queries'
import { displayName } from '@/types'
import {
  READY_THRESHOLD,
  STATE_PASS_MARK,
  readinessScale,
} from '@/lib/readiness'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge, EnrollmentStatusBadge } from '@/components/ui/Badge'
import { ComingSoon, EmptyState } from '@/components/ui/States'
import { ProgressBar, Stat } from '@/components/ui/Progress'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { user, profile } = await requireAuth()
  const { data: enrollments, error } = await getMyEnrollments(user.id)

  const active = (enrollments ?? []).filter((item) => item.status === 'active')
  const continueLearning = active[0] ?? null

  return (
    <>
      <PageHeader
        title={`Welcome back, ${displayName(profile)}`}
        description="Your preparation at a glance."
      />

      {error && (
        <div className="mb-6">
          <Alert variant="warning" title="Some information is unavailable">
            {error}
          </Alert>
        </div>
      )}

      {/* Summary figures. Only the enrollment count is real data in Phase 1;
          the others are explicitly marked as not yet measured rather than
          filled with invented numbers. */}
      <Card>
        <CardBody>
          <dl className="grid gap-6 sm:grid-cols-3">
            <Stat
              label="Enrolled courses"
              value={String(active.length)}
              hint={active.length === 1 ? 'course in progress' : 'courses in progress'}
            />
            <Stat
              label="Practice exams taken"
              value="—"
              hint="Available in a later release"
            />
            <Stat
              label="Readiness"
              value="—"
              hint={`Unlocks after your first scored quiz · ready at ${READY_THRESHOLD}%`}
            />
          </dl>
        </CardBody>
      </Card>

      {/* Continue learning */}
      <section className="mt-6">
        <Card>
          <CardHeader
            title="Continue learning"
            description="Pick up where you left off."
          />
          {continueLearning ? (
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">
                    {continueLearning.course?.title ?? 'Course'}
                  </h3>
                  <div className="mt-2">
                    <EnrollmentStatusBadge status={continueLearning.status} />
                  </div>
                </div>
                <Badge tone="neutral">Lessons coming soon</Badge>
              </div>
              <div className="mt-5 max-w-md">
                <ProgressBar label="Course progress" value={0} hasData={false} />
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Lesson navigation arrives with the course content release. Your
                enrollment is already active and will carry over.
              </p>
            </CardBody>
          ) : (
            <EmptyState
              title="You are not enrolled in a course yet"
              description="Browse the catalogue to see what is available. Once you are enrolled, your next lesson appears here."
              action={
                <ButtonLink href="/courses" variant="secondary">
                  Browse the catalogue
                </ButtonLink>
              }
            />
          )}
        </Card>
      </section>

      {/* Enrolled courses */}
      <section className="mt-6">
        <Card>
          <CardHeader
            title="Your courses"
            action={
              <Link
                href="/dashboard/courses"
                className="text-navy-700 text-sm font-medium hover:underline"
              >
                View all
              </Link>
            }
          />
          {active.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {active.slice(0, 3).map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {enrollment.course?.title ?? 'Course unavailable'}
                  </span>
                  <EnrollmentStatusBadge status={enrollment.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No enrollments"
              description="Courses you enrol in will be listed here."
            />
          )}
        </Card>
      </section>

      {/* Phase 2+ placeholders, labelled as such. */}
      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <ComingSoon
          title="Overall progress"
          description="Topic-by-topic mastery across every module, calculated from your quiz and practice-exam results."
        />
        <ComingSoon
          title="Practice exams"
          description="Full-length timed simulations matching the pacing and structure of the Texas state examination."
        />
        <ComingSoon
          title="Recent activity"
          description="A running log of lessons completed, quizzes taken and scores recorded."
        />
        {/* The scale is shown before any score exists on purpose: a student
            should know what they are aiming at from the first day, not
            discover the bar the first time they fall short of it. The numbers
            come from lib/readiness.ts so this card and the eventual
            calculation cannot disagree. */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Exam readiness</h2>
            <p className="mt-1 text-sm text-slate-500">
              A single clear answer to the question that matters: are you ready
              to book the exam? Scoring arrives with the practice exams; this
              is the scale it will use.
            </p>
            <dl className="mt-4 space-y-3">
              {readinessScale().map((band) => (
                <div key={band.band} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-sm font-medium text-slate-800 tabular-nums">
                    {band.from}–{band.to}%
                  </dt>
                  <dd className="min-w-0 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">
                      {band.label}
                    </span>
                    <span className="block text-slate-500">{band.advice}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              The state examination passes at {STATE_PASS_MARK}%. We set the
              bar higher so that &ldquo;ready&rdquo; means ready on the day.
            </p>
          </CardBody>
        </Card>
      </section>
    </>
  )
}
