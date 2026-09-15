import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth'
import { getMyEnrollments } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EnrollmentStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'

export const metadata: Metadata = { title: 'My courses' }

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', DATE_FORMAT)
}

export default async function MyCoursesPage() {
  const { user } = await requireAuth()
  const { data: enrollments, error } = await getMyEnrollments(user.id)

  return (
    <>
      <PageHeader
        title="My courses"
        description="Every course your account has access to."
      />

      {error && (
        <Alert variant="warning" title="Courses unavailable">
          {error}
        </Alert>
      )}

      {enrollments && enrollments.length === 0 && (
        <Card>
          <EmptyState
            title="You are not enrolled in any courses"
            description="Once you enrol, your courses appear here with their status and access dates."
            action={
              <ButtonLink href="/courses" variant="secondary">
                Browse the catalogue
              </ButtonLink>
            }
          />
        </Card>
      )}

      {enrollments && enrollments.length > 0 && (
        <ul className="grid gap-6 md:grid-cols-2">
          {enrollments.map((enrollment) => {
            const enrolledOn = formatDate(enrollment.enrolled_at)
            const expiresOn = formatDate(enrollment.expires_at)

            return (
              <Card key={enrollment.id} as="li" className="flex flex-col">
                <CardBody className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      {/* The course row can be absent if RLS hides it — for
                          example an enrollment in a course that was moved back
                          to draft. Degrade rather than crash. */}
                      {enrollment.course?.title ?? 'Course unavailable'}
                    </h2>
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </div>

                  {enrollment.course?.description && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {enrollment.course.description}
                    </p>
                  )}

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {enrolledOn && (
                      <div>
                        <dt className="text-slate-500">Enrolled</dt>
                        <dd className="text-slate-800">{enrolledOn}</dd>
                      </div>
                    )}
                    {expiresOn && (
                      <div>
                        <dt className="text-slate-500">Access until</dt>
                        <dd className="text-slate-800">{expiresOn}</dd>
                      </div>
                    )}
                  </dl>
                </CardBody>

                <CardFooter>
                  {enrollment.course ? (
                    <ButtonLink
                      href={`/dashboard/courses/${enrollment.course.slug}`}
                      variant="secondary"
                      size="sm"
                    >
                      Open course
                    </ButtonLink>
                  ) : (
                    <p className="text-sm text-slate-500">
                      This course is not currently available.
                    </p>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </ul>
      )}
    </>
  )
}
