import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import {
  getCourseOutline,
  getLessonWithContent,
  getMyEnrollmentForCourseSlug,
} from '@/lib/queries'
import { locateLesson } from '@/lib/lesson-navigation'
import { formatStudyTime } from '@/types'
import { Markdown } from '@/components/Markdown'
import { Card, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

export const metadata: Metadata = { title: 'Lesson' }

type Params = { params: Promise<{ courseSlug: string; lessonSlug: string }> }

/**
 * The lesson reader.
 *
 * The entitlement decision is not made in this file. `getLessonWithContent`
 * returns null whenever the database declined to release the body — because
 * the lesson does not exist, because it is not published, or because the
 * caller has no live enrollment — and those three cases are indistinguishable
 * on purpose, so this page cannot be used to enumerate unpublished lesson
 * slugs.
 *
 * What this page does do, once the body has already been withheld, is look up
 * the reader's OWN enrollment in order to explain the situation. That is the
 * student's own data; telling them about it discloses nothing they did not
 * already know, and "enrol to read this" versus "your access expired" are
 * different problems with different fixes.
 */
export default async function LessonPage({ params }: Params) {
  const { courseSlug, lessonSlug } = await params
  const { user } = await requireAuth()

  const [{ data: lesson, error }, { data: outline }] = await Promise.all([
    getLessonWithContent(courseSlug, lessonSlug),
    getCourseOutline(courseSlug),
  ])

  if (error) {
    return (
      <Alert variant="warning" title="Lesson unavailable">
        {error}
      </Alert>
    )
  }

  if (!lesson) {
    // The body was withheld. If the lesson is not even in the public outline,
    // there is nothing to explain — it is a 404 like any other.
    const inOutline = outline
      ? locateLesson(outline, lessonSlug) !== null
      : false
    if (!outline || !inOutline) notFound()

    const { data: enrollment } = await getMyEnrollmentForCourseSlug(
      user.id,
      courseSlug,
    )

    return (
      <>
        <nav className="mb-6 text-sm">
          <Link
            href={`/dashboard/courses/${courseSlug}`}
            className="text-navy-700 hover:text-navy-900 hover:underline"
          >
            ← {outline.course.title}
          </Link>
        </nav>

        <Alert
          variant="info"
          title={
            enrollment
              ? 'Your access to this course is not active'
              : 'This lesson is for enrolled students'
          }
        >
          {enrollment
            ? 'Your enrollment is no longer live, so lesson content is not available. The full syllabus is still on the course page.'
            : 'Enrol in this course to read the lesson. You can see the complete syllabus on the course page.'}
        </Alert>

        <div className="mt-6">
          <ButtonLink
            href={`/dashboard/courses/${courseSlug}`}
            variant="secondary"
          >
            Back to the course
          </ButtonLink>
        </div>
      </>
    )
  }

  const position = outline ? locateLesson(outline, lessonSlug) : null
  const studyTime = formatStudyTime(lesson.estimated_minutes)

  return (
    <>
      <nav className="mb-6 text-sm">
        <Link
          href={`/dashboard/courses/${lesson.courseSlug}`}
          className="text-navy-700 hover:text-navy-900 hover:underline"
        >
          ← {lesson.courseTitle}
        </Link>
      </nav>

      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-slate-500">
          {lesson.moduleTitle}
          {position ? ` · Lesson ${position.index + 1} of ${position.total}` : ''}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          {lesson.title}
        </h1>
        {lesson.summary && (
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
            {lesson.summary}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          {studyTime && <span>{studyTime} read</span>}
          {lesson.topics.length > 0 && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="sr-only">Exam topics covered:</span>
              {lesson.topics.map((topic) => (
                <span
                  key={topic.id}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                  title={`Blueprint topic ${topic.code}`}
                >
                  {topic.name}
                </span>
              ))}
            </span>
          )}
        </div>
      </header>

      <article className="max-w-2xl">
        <Markdown source={lesson.body} />
      </article>

      {position && (position.previous || position.next) && (
        <Card className="mt-12">
          <CardBody>
            {/* No spacer element when there is no previous lesson. An empty
                flex child left a large blank half inside a bordered card,
                which reads as something that failed to load. A single link
                simply takes the full width instead. */}
            <div className="flex flex-wrap items-stretch gap-4">
              {position.previous && (
                <Link
                  href={`/dashboard/courses/${lesson.courseSlug}/${position.previous.slug}`}
                  className="group min-w-0 flex-1 basis-56 rounded-(--radius-card) border border-slate-200 p-4 hover:border-navy-300 hover:bg-slate-50"
                >
                  <span className="text-xs font-medium text-slate-500">
                    Previous
                  </span>
                  <span className="mt-1 block font-medium text-slate-800 group-hover:text-navy-800">
                    {position.previous.title}
                  </span>
                </Link>
              )}

              {position.next && (
                <Link
                  href={`/dashboard/courses/${lesson.courseSlug}/${position.next.slug}`}
                  className="group min-w-0 flex-1 basis-56 rounded-(--radius-card) border border-slate-200 p-4 text-right hover:border-navy-300 hover:bg-slate-50"
                >
                  <span className="text-xs font-medium text-slate-500">
                    Next
                  </span>
                  <span className="mt-1 block font-medium text-slate-800 group-hover:text-navy-800">
                    {position.next.title}
                  </span>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </>
  )
}
