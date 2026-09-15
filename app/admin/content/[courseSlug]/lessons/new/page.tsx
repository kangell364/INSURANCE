import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent, getCourseTopics } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { LessonForm } from '@/components/admin/LessonForm'

export const metadata: Metadata = { title: 'New lesson' }

export default async function NewLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>
  searchParams: Promise<{ moduleId?: string }>
}) {
  const { courseSlug } = await params
  const { moduleId } = await searchParams
  if (!(await requireAdmin())) return null

  const { data } = await getAdminCourseContent(courseSlug)
  if (!data) notFound()

  // The module must belong to THIS course. Without the check, a moduleId from
  // another course would render a form that writes a lesson somewhere the
  // author is not looking — the composite foreign key would keep the data
  // consistent, but the author would still have written into the wrong place.
  const moduleRow = data.modules.find((m) => m.id === moduleId)
  if (!moduleRow) notFound()

  const { data: topics } = await getCourseTopics(data.course.id)

  return (
    <>
      <PageHeader
        eyebrow={data.course.title}
        title="New lesson"
        description={`Added to "${moduleRow.title}" at the end. Reorder from the course page.`}
      />
      <LessonForm
        courseSlug={courseSlug}
        moduleId={moduleRow.id}
        moduleTitle={moduleRow.title}
        topics={topics ?? []}
      />
    </>
  )
}
