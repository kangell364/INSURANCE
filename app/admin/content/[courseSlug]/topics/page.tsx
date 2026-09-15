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
import { blueprintShare, totalBlueprintQuestions } from '@/types'

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

  // A blueprint transcribed with a row missing still LOOKS complete. The
  // error only surfaces much later, as a readiness score weighting the wrong
  // things, so it is worth checking the arithmetic here where it is cheap.
  //
  // Two shapes of blueprint, two checks. Texas publishes question COUNTS, so
  // the meaningful figure is the total and whether it matches the published
  // exam length. Percentage blueprints must sum to 100.
  const counted = roots.filter((t) => t.question_count !== null)
  const totalQuestions = totalBlueprintQuestions(roots)

  const weighted = roots.filter(
    (t) => t.question_count === null && t.blueprint_weight !== null,
  )
  const totalWeight = weighted.reduce(
    (sum, t) => sum + Number(t.blueprint_weight ?? 0),
    0,
  )
  const weightLooksWrong =
    weighted.length > 0 && Math.abs(totalWeight - 100) > 0.5

  // Only meaningful once most sections carry a figure; mid-transcription is
  // not an error to shout about.
  const mixedUnits = counted.length > 0 && weighted.length > 0

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
        description="The state's own topic list, with the number of scored questions it assigns to each area. Lessons are tagged against it, and it is what makes a readiness score say which topics to revise."
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

      {totalQuestions !== null && (
        <div className="mb-6">
          <Alert variant="info" title="Blueprint total">
            {counted.length} top-level{' '}
            {counted.length === 1 ? 'section carries' : 'sections carry'} a
            question count, totalling{' '}
            <strong>{totalQuestions} scored questions</strong>. Check that
            against the published outline — for Texas General Lines Property
            and Casualty it should be 130 (100 general knowledge plus 30 state
            specific).
          </Alert>
        </div>
      )}

      {mixedUnits && (
        <div className="mb-6">
          <Alert variant="warning" title="Mixed units in one blueprint">
            Some sections give a question count and others a percentage. Pick
            one: a readiness score computed across both is comparing different
            things. Where the published outline gives counts, use counts.
          </Alert>
        </div>
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
                      {blueprintShare(topic, totalQuestions) ?? 'No weighting'}
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
