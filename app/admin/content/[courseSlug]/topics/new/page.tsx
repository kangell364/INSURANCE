import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent, getCourseTopics } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { TopicForm } from '@/components/admin/TopicForm'

export const metadata: Metadata = { title: 'New topic' }

export default async function NewTopicPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  if (!(await requireAdmin())) return null

  const { data } = await getAdminCourseContent(courseSlug)
  if (!data) notFound()

  const { data: topics } = await getCourseTopics(data.course.id)

  return (
    <>
      <PageHeader eyebrow={data.course.title} title="New blueprint topic" />
      <TopicForm
        courseId={data.course.id}
        courseSlug={courseSlug}
        parentOptions={(topics ?? [])
          .filter((t) => t.parent_topic_id === null)
          .map(({ id, code, name }) => ({ id, code, name }))}
      />
    </>
  )
}
