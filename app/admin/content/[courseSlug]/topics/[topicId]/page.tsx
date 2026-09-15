import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent, getCourseTopics } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { TopicForm } from '@/components/admin/TopicForm'

export const metadata: Metadata = { title: 'Edit topic' }

export default async function EditTopicPage({
  params,
}: {
  params: Promise<{ courseSlug: string; topicId: string }>
}) {
  const { courseSlug, topicId } = await params
  if (!(await requireAdmin())) return null

  const { data } = await getAdminCourseContent(courseSlug)
  if (!data) notFound()

  const { data: topics } = await getCourseTopics(data.course.id)
  const topic = (topics ?? []).find((t) => t.id === topicId)
  if (!topic) notFound()

  return (
    <>
      <nav className="mb-4 text-sm">
        <Link
          href={`/admin/content/${courseSlug}/topics`}
          className="text-navy-700 hover:underline"
        >
          ← Back to the blueprint
        </Link>
      </nav>

      <PageHeader eyebrow={data.course.title} title="Edit topic" />

      <TopicForm
        courseId={data.course.id}
        courseSlug={courseSlug}
        parentOptions={(topics ?? [])
          .filter((t) => t.parent_topic_id === null)
          .map(({ id, code, name }) => ({ id, code, name }))}
        topic={{
          id: topic.id,
          code: topic.code,
          name: topic.name,
          parentTopicId: topic.parent_topic_id,
          questionCount: topic.question_count,
          blueprintWeight: topic.blueprint_weight,
        }}
      />
    </>
  )
}
