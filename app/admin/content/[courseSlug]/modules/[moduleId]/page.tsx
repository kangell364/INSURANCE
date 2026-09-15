import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleForm } from '@/components/admin/ModuleForm'

export const metadata: Metadata = { title: 'Edit module' }

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ courseSlug: string; moduleId: string }>
}) {
  const { courseSlug, moduleId } = await params
  if (!(await requireAdmin())) return null

  const { data } = await getAdminCourseContent(courseSlug)
  if (!data) notFound()

  const moduleRow = data.modules.find((m) => m.id === moduleId)
  if (!moduleRow) notFound()

  return (
    <>
      <PageHeader
        eyebrow={data.course.title}
        title="Edit module"
        description={`${moduleRow.lessons.length} ${
          moduleRow.lessons.length === 1 ? 'lesson' : 'lessons'
        } in this module.`}
      />
      <ModuleForm
        courseId={data.course.id}
        courseSlug={courseSlug}
        module={{
          id: moduleRow.id,
          title: moduleRow.title,
          description: moduleRow.description,
          status: moduleRow.status,
        }}
      />
    </>
  )
}
