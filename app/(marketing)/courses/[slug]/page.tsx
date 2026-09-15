import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/States'
import { getCourseOutline, getTopicTree } from '@/lib/queries'
import {
  blueprintShare,
  formatStudyTime,
  totalBlueprintQuestions,
} from '@/types'

type Params = { params: Promise<{ slug: string }> }

/**
 * The public syllabus page.
 *
 * Everything rendered here comes from `modules`, `lessons` and `topics`, all of
 * which anonymous visitors may read. Lesson BODIES are not fetched at all —
 * not fetched and then hidden, not fetched and then trimmed. There is no code
 * path from this file to public.lesson_contents.
 *
 * This is also the page most likely to earn search traffic: "what is on the
 * Texas general lines exam" is a question thousands of people type every month,
 * and the blueprint section answers it directly.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const { data } = await getCourseOutline(slug)
  if (!data) return { title: 'Course' }

  return {
    title: data.course.title,
    description:
      data.course.description ??
      `Syllabus and exam blueprint for ${data.course.title}.`,
    alternates: { canonical: `/courses/${data.course.slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params
  const { data: outline, error } = await getCourseOutline(slug)

  if (error) {
    return (
      <div className="container-page py-12 sm:py-16">
        <Alert variant="warning" title="Course unavailable">
          {error}
        </Alert>
      </div>
    )
  }

  if (!outline) notFound()

  const { course, modules, lessonCount, estimatedMinutes } = outline
  const { data: topics } = await getTopicTree(course.id)
  const studyTime = formatStudyTime(estimatedMinutes)
  const examQuestions = totalBlueprintQuestions(topics ?? [])

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Course"
        title={course.title}
        description={course.description ?? undefined}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
        <span>
          <strong className="font-semibold text-slate-900">
            {modules.length}
          </strong>{' '}
          {modules.length === 1 ? 'module' : 'modules'}
        </span>
        <span>
          <strong className="font-semibold text-slate-900">
            {lessonCount}
          </strong>{' '}
          {lessonCount === 1 ? 'lesson' : 'lessons'}
        </span>
        {studyTime && (
          <span>
            <strong className="font-semibold text-slate-900">
              {studyTime}
            </strong>{' '}
            of material
          </span>
        )}
      </div>

      <div className="mt-8">
        <ButtonLink href="/signup">Create an account</ButtonLink>
      </div>

      <h2 className="mt-12 text-xl font-semibold sm:text-2xl">Syllabus</h2>

      {modules.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            title="The syllabus is being written"
            description="This course is published but its modules are not ready yet. Create an account and we will tell you when it opens."
          />
        </Card>
      ) : (
        <ol className="mt-4 space-y-5">
          {modules.map((module, index) => (
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
                    Lessons for this module are not published yet.
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
                            <span className="font-medium text-slate-800">
                              {lesson.title}
                            </span>
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

      {topics && topics.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold sm:text-2xl">
            What the state exam covers
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            The topics below follow the published examination blueprint, which
            assigns each area a set number of the exam&rsquo;s scored
            questions.
            {examQuestions
              ? ` There are ${examQuestions} scored questions in total.`
              : ''}
          </p>
          <ul className="mt-4 space-y-4">
            {topics.map((topic) => (
              <Card key={topic.id} as="li">
                <CardBody>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-base font-semibold">
                      <span className="font-mono text-sm text-slate-400">
                        {topic.code}
                      </span>{' '}
                      {topic.name}
                    </h3>
                    {blueprintShare(topic, examQuestions) && (
                      <span className="text-sm font-medium text-slate-600 tabular-nums">
                        {blueprintShare(topic, examQuestions)}
                      </span>
                    )}
                  </div>
                  {topic.children.length > 0 && (
                    <ul className="mt-3 space-y-1 border-l-2 border-slate-100 pl-4">
                      {topic.children.map((child) => (
                        <li key={child.id} className="text-sm text-slate-600">
                          <span className="font-mono text-xs text-slate-400">
                            {child.code}
                          </span>{' '}
                          {child.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            ))}
          </ul>
        </>
      )}

      <Card className="mt-12">
        <CardBody>
          <h2 className="text-lg font-semibold">Ready to start?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Lesson content is available to enrolled students. Create an account
            to get started.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Create an account</ButtonLink>
            <Link
              href="/courses"
              className="inline-flex items-center px-1 py-2 text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900"
            >
              Back to all courses
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
