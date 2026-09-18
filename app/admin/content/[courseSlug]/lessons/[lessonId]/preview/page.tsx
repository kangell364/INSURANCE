import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getLessonForEdit } from '@/lib/queries'
import { formatStudyTime } from '@/types'
import { Markdown } from '@/components/Markdown'
import { Alert } from '@/components/ui/Alert'
import { ButtonLink } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Preview lesson' }

/**
 * A draft lesson, rendered the way a student would meet it.
 *
 * The reviewer's problem this solves: nothing reaches a student until a module
 * is signed off, so the only way to read a draft was the edit form, which
 * shows the body as markdown in a textarea. Reviewing prose in a textarea is
 * not reviewing what the student reads, and the alternative -- signing a
 * module off to look at it -- is exactly the attestation the review gate
 * exists to protect.
 *
 * So: same header, same `Markdown` component, same measure as
 * app/dashboard/courses/[courseSlug]/[lessonSlug]/page.tsx. What differs is
 * everything that is NOT the lesson -- no quiz, no next/previous, and a
 * banner saying plainly that a student sees none of this yet.
 *
 * This grants no new access. `getLessonForEdit` goes through the RLS-governed
 * client, so the draft comes back because the caller's own database policy
 * allows it, not because this route asked nicely. `requireAdmin` returning
 * null renders nothing at all.
 */
export default async function PreviewLessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>
}) {
  const { courseSlug, lessonId } = await params
  if (!(await requireAdmin())) return null

  const { data: lesson, error } = await getLessonForEdit(lessonId)

  if (error) {
    return (
      <Alert variant="warning" title="Lesson unavailable">
        {error}
      </Alert>
    )
  }
  if (!lesson) notFound()

  const studyTime = formatStudyTime(lesson.estimated_minutes)
  // 'active' is the released state, not 'published' -- and the RLS policy
  // checks the whole chain, so an active lesson under a draft module is still
  // invisible. This banner only claims what this page can actually see.
  const isDraft = lesson.status !== 'active'

  return (
    <>
      <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link
          href={`/admin/content/${courseSlug}`}
          className="text-navy-700 hover:text-navy-900 hover:underline"
        >
          ← Back to the course
        </Link>
        <Link
          href={`/admin/content/${courseSlug}/lessons/${lesson.id}`}
          className="text-navy-700 hover:text-navy-900 hover:underline"
        >
          Edit this lesson
        </Link>
      </nav>

      {isDraft && (
        <Alert variant="info" title="Draft — a student cannot see this">
          This is the lesson as it would appear once it is released. Nothing
          here is visible to a student: the lesson is a draft, and a student
          also sees nothing unless its module and course are both active. The
          quiz and the next/previous links are left out because they depend on
          published content.
        </Alert>
      )}

      {/* From here down, this deliberately mirrors the student lesson page.
          If that page's header or measure changes, change it here too, or the
          preview stops being a preview. */}
      <header className="mt-8 mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-slate-500">
          {lesson.moduleTitle}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          {lesson.title}
        </h1>
        {lesson.summary && (
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-600">
            {lesson.summary}
          </p>
        )}
        {studyTime && (
          <div className="mt-4 text-sm text-slate-500">{studyTime} read</div>
        )}
      </header>

      <article className="max-w-2xl">
        <Markdown source={lesson.body ?? ''} />
      </article>

      <div className="mt-12 border-t border-slate-200 pt-6">
        <ButtonLink
          href={`/admin/content/${courseSlug}/lessons/${lesson.id}`}
          variant="secondary"
        >
          Edit this lesson
        </ButtonLink>
      </div>
    </>
  )
}
