import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleForm } from '@/components/admin/ModuleForm'

export const metadata: Metadata = { title: 'New module' }

export default async function NewModulePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  if (!(await requireAdmin())) return null

  const { data } = await getAdminCourseContent(courseSlug)
  if (!data) notFound()

  return (
    <>
      <PageHeader
        eyebrow={data.course.title}
        title="New module"
        description="A module is a chapter of the course. Its position is set automatically and can be changed afterwards."
      />
      <ModuleForm courseId={data.course.id} courseSlug={courseSlug} />
    </>
  )
}
