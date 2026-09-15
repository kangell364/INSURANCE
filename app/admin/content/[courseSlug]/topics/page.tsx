import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent, getCourseTopics } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/States'

export const metadata: Metadata = { title: 'Exam blueprint' }

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  if (!(await requireAdmin())) return null

  const { data: course } = await getAdminCourseContent(courseSlug)
  if (!course) notFound()

  const { data: topics, error } = await getCourseTopics(course.course.id)
  const roots = (topics ?? []).filter((t) => t.parent_topic_id === null)

  // Weightings should add up to roughly 100%. Flagging a total that does not
  // is worth doing: a blueprint transcribed with a missing row still looks
  // complete, and the error only surfaces much later as a readiness score
  // that weights the wrong things.
  const weighted = roots.filter((t) => t.blueprint_weight !== null)
  const totalWeight = weighted.reduce(
    (sum, t) => sum + Number(t.blueprint_weight ?? 0),
    0,
  )
  const weightLooksWrong =
    weighted.length > 0 && Math.abs(totalWeight - 100) > 0.5

  return (
    <>
      <nav className="mb-4 text-sm">
        <Link
          href={`/admin/content/${courseSlug}`}
          className="text-navy-700 hover:underline"
        >
          ← Back to the course
        </Link>
      </nav>

      <PageHeader
        eyebrow={course.course.title}
        title="Exam blueprint"
        description="The state's own topic list. Lessons are tagged against it, and it is what makes a readiness score say which topics to revise."
      />

      <div className="mb-6">
        <ButtonLink
          href={`/admin/content/${courseSlug}/topics/new`}
          size="sm"
        >
          Add a topic
        </ButtonLink>
      </div>

      {error && (
        <Alert variant="warning" title="Topics unavailable">
          {error}
        </Alert>
      )}

      {weightLooksWrong && (
        <div className="mb-6">
          <Alert variant="warning" title="Weightings do not add up to 100%">
            The top-level weightings total {totalWeight.toFixed(2)}%. Check the
            published blueprint — a missing topic is easy to miss here and
            skews every readiness score computed from it.
          </Alert>
        </div>
      )}

      {roots.length === 0 ? (
        <Card>
          <EmptyState
            title="No topics yet"
            description="Add the topics from the published examination blueprint, with their percentage weightings where the blueprint gives them."
            action={
              <ButtonLink href={`/admin/content/${courseSlug}/topics/new`}>
                Add the first topic
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {roots.map((topic) => {
            const children = (topics ?? []).filter(
              (t) => t.parent_topic_id === topic.id,
            )
            return (
              <Card key={topic.id} as="li">
                <CardBody>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-base font-semibold">
                      <span className="font-mono text-sm text-slate-400">
                        {topic.code}
                      </span>{' '}
                      <Link
                        href={`/admin/content/${courseSlug}/topics/${topic.id}`}
                        className="text-navy-800 hover:underline"
                      >
                        {topic.name}
                      </Link>
                    </h2>
                    <span className="text-sm text-slate-600 tabular-nums">
                      {topic.blueprint_weight !== null
                        ? `${topic.blueprint_weight}%`
                        : 'No weighting'}
                    </span>
                  </div>

                  {children.length > 0 && (
                    <ul className="mt-3 space-y-1 border-l-2 border-slate-100 pl-4">
                      {children.map((child) => (
                        <li key={child.id} className="text-sm">
                          <span className="font-mono text-xs text-slate-400">
                            {child.code}
                          </span>{' '}
                          <Link
                            href={`/admin/content/${courseSlug}/topics/${child.id}`}
                            className="text-slate-700 hover:underline"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </ul>
      )}
    </>
  )
}
