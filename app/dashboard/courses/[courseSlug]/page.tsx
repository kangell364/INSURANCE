import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import {
  getCourseOutline,
  getMyEnrollmentForCourseSlug,
  hasLiveEnrollment,
} from '@/lib/queries'
import { firstLesson } from '@/lib/lesson-navigation'
import { formatStudyTime } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EnrollmentStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'

export const metadata: Metadata = { title: 'Course' }

type Params = { params: Promise<{ courseSlug: string }> }

export default async function DashboardCoursePage({ params }: Params) {
  const { courseSlug } = await params
  const { user } = await requireAuth()

  const [{ data: outline, error }, { data: enrollment }] = await Promise.all([
    getCourseOutline(courseSlug),
    getMyEnrollmentForCourseSlug(user.id, courseSlug),
  ])

  if (error) {
    return (
      <Alert variant="warning" title="Course unavailable">
        {error}
      </Alert>
    )
  }
  if (!outline) notFound()

  // Whether the reader may open a lesson is decided per lesson, by RLS, when
  // the body is requested. This flag only chooses what the page SAYS.
  //
  // It still asks the DATABASE rather than deciding from the enrollment row
  // above, so that the page's answer and the policy's answer come from the
  // same function. Working the expiry out here would be a second definition of
  // entitlement, and the first time the two disagreed the symptom would be a
  // lesson link that leads to a refusal.
  const hasLiveAccess = await hasLiveEnrollment(outline.course.id)

  const start = firstLesson(outline)
  const studyTime = formatStudyTime(outline.estimatedMinutes)

  return (
    <>
      <PageHeader
        eyebrow="Course"
        title={outline.course.title}
        description={outline.course.description ?? undefined}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {enrollment && <EnrollmentStatusBadge status={enrollment.status} />}
        <span className="text-sm text-slate-600">
          {outline.lessonCount}{' '}
          {outline.lessonCount === 1 ? 'lesson' : 'lessons'}
          {studyTime ? ` · ${studyTime}` : ''}
        </span>
      </div>

      {!hasLiveAccess && (
        <div className="mb-6">
          <Alert
            variant="info"
            title={
              enrollment
                ? 'Your access to this course is not active'
                : 'You are not enrolled in this course'
            }
          >
            {enrollment
              ? 'You can still read the syllabus. Lesson content needs a live enrollment.'
              : 'The syllabus below is the full outline. Lesson content is available to enrolled students.'}
          </Alert>
        </div>
      )}

      {hasLiveAccess && start && (
        <div className="mb-8">
          <ButtonLink
            href={`/dashboard/courses/${outline.course.slug}/${start.slug}`}
          >
            Start with &ldquo;{start.title}&rdquo;
          </ButtonLink>
        </div>
      )}

      {outline.modules.length === 0 ? (
        <Card>
          <EmptyState
            title="No lessons published yet"
            description="This course has no published modules. Check back soon."
          />
        </Card>
      ) : (
        <ol className="space-y-5">
          {outline.modules.map((module, index) => (
            <Card key={module.id} as="li">
              <CardHeader
                title={
                  <span>
                    <span className="text-slate-400 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>{' '}
                    {module.title}
                  </span>
                }
                description={module.description ?? undefined}
              />
              <CardBody>
                {module.lessons.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">
                    No published lessons in this module yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {module.lessons.map((lesson) => {
                      const lessonTime = formatStudyTime(
                        lesson.estimated_minutes,
                      )
                      return (
                        <li
                          key={lesson.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                        >
                          <div className="min-w-0">
                            {hasLiveAccess ? (
                              <Link
                                href={`/dashboard/courses/${outline.course.slug}/${lesson.slug}`}
                                className="font-medium text-navy-700 hover:text-navy-900 hover:underline"
                              >
                                {lesson.title}
                              </Link>
                            ) : (
                              <span className="font-medium text-slate-800">
                                {lesson.title}
                              </span>
                            )}
                            {lesson.summary && (
                              <p className="mt-0.5 text-sm text-slate-500">
                                {lesson.summary}
                              </p>
                            )}
                          </div>
                          {lessonTime && (
                            <span className="text-sm whitespace-nowrap text-slate-500 tabular-nums">
                              {lessonTime}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </ol>
      )}
    </>
  )
}
