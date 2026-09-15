import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getCourseTopics, getLessonForEdit } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { LessonForm } from '@/components/admin/LessonForm'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { deleteContentAction } from '@/app/admin/content/actions'

export const metadata: Metadata = { title: 'Edit lesson' }

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>
}) {
  const { courseSlug, lessonId } = await params
  if (!(await requireAdmin())) return null

  const { data: lesson } = await getLessonForEdit(lessonId)
  if (!lesson) notFound()

  const { data: topics } = await getCourseTopics(lesson.course_id)

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

      <PageHeader eyebrow={lesson.moduleTitle} title="Edit lesson" />

      <LessonForm
        courseSlug={courseSlug}
        moduleId={lesson.module_id}
        moduleTitle={lesson.moduleTitle}
        topics={topics ?? []}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          summary: lesson.summary,
          status: lesson.status,
          estimatedMinutes: lesson.estimated_minutes,
          body: lesson.body,
          topicIds: lesson.topicIds,
        }}
      />

      <div className="mt-8 border-t border-slate-200 pt-6">
        <form action={deleteContentAction}>
          <input type="hidden" name="kind" value="lesson" />
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <ConfirmButton
            message={`Delete "${lesson.title}" and everything written in it? This cannot be undone.`}
          >
            Delete this lesson
          </ConfirmButton>
        </form>
      </div>
    </>
  )
}
