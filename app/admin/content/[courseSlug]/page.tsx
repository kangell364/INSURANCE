import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAdminCourseContent } from '@/lib/queries'
import {
  deleteContentAction,
  moveContentAction,
  setStatusAction,
} from '@/app/admin/content/actions'
import { contentStatusLabel, formatStudyTime } from '@/types'
import type { AdminLesson, AdminModule } from '@/lib/queries'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { ConfirmButton } from '@/components/admin/ConfirmButton'

export const metadata: Metadata = { title: 'Course content' }

type Params = { params: Promise<{ courseSlug: string }> }

function StatusBadge({ status }: { status: AdminModule['status'] }) {
  return (
    <Badge
      tone={
        status === 'active'
          ? 'success'
          : status === 'archived'
            ? 'neutral'
            : 'warning'
      }
    >
      {contentStatusLabel(status)}
    </Badge>
  )
}

/**
 * A single-button form bound to a server action.
 *
 * Reorder and publish are state changes, so they are POSTs rather than links.
 * A GET that mutates is the classic way to have a browser prefetcher or a
 * crawler quietly reorder someone's course.
 */
function ActionButton({
  action,
  fields,
  children,
  disabled,
  label,
}: {
  action: (formData: FormData) => Promise<void>
  fields: Record<string, string>
  children: React.ReactNode
  disabled?: boolean
  label: string
}) {
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        title={label}
        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    </form>
  )
}

export default async function AdminCourseContentPage({ params }: Params) {
  const { courseSlug } = await params
  const context = await requireAdmin()
  if (!context) return null

  const { data, error } = await getAdminCourseContent(courseSlug)

  if (error) {
    return (
      <Alert variant="warning" title="Content unavailable">
        {error}
      </Alert>
    )
  }
  if (!data) notFound()

  const { course, modules } = data
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0)
  const publishedLessons = modules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.status === 'active').length,
    0,
  )
  const emptyLessons = modules.reduce(
    (n, m) => n + m.lessons.filter((l) => !l.hasBody).length,
    0,
  )

  return (
    <>
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/content"
          className="text-navy-700 hover:underline"
        >
          ← All courses
        </Link>
      </nav>

      <PageHeader
        eyebrow="Course content"
        title={course.title}
        description={`${modules.length} ${
          modules.length === 1 ? 'module' : 'modules'
        } · ${lessonCount} ${
          lessonCount === 1 ? 'lesson' : 'lessons'
        } · ${publishedLessons} published`}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <ButtonLink href={`/admin/content/${courseSlug}/modules/new`} size="sm">
          Add a module
        </ButtonLink>
        <ButtonLink
          href={`/admin/content/${courseSlug}/topics`}
          variant="secondary"
          size="sm"
        >
          Exam blueprint
        </ButtonLink>
        <ButtonLink
          href={`/courses/${courseSlug}`}
          variant="secondary"
          size="sm"
        >
          View public syllabus
        </ButtonLink>
      </div>

      {emptyLessons > 0 && (
        <div className="mb-6">
          <Alert variant="info" title="Lessons with no content">
            {emptyLessons} {emptyLessons === 1 ? 'lesson has' : 'lessons have'}{' '}
            no body written yet. A published lesson with an empty body shows a
            student an empty page, so it is worth checking before publishing.
          </Alert>
        </div>
      )}

      {modules.length === 0 ? (
        <Card>
          <EmptyState
            title="No modules yet"
            description="A module is a chapter of the course. Add the first one to start writing lessons."
            action={
              <ButtonLink href={`/admin/content/${courseSlug}/modules/new`}>
                Add a module
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ol className="space-y-5">
          {modules.map((module, index) => (
            <ModuleCard
              key={module.id}
              module={module}
              index={index}
              total={modules.length}
              courseSlug={courseSlug}
            />
          ))}
        </ol>
      )}
    </>
  )
}

function ModuleCard({
  module,
  index,
  total,
  courseSlug,
}: {
  module: AdminModule
  index: number
  total: number
  courseSlug: string
}) {
  const nextStatus = module.status === 'active' ? 'draft' : 'active'

  return (
    <Card as="li">
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              <span className="text-slate-400 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>{' '}
              <Link
                href={`/admin/content/${courseSlug}/modules/${module.id}`}
                className="text-navy-800 hover:underline"
              >
                {module.title}
              </Link>
            </h2>
            {module.description && (
              <p className="mt-1 text-sm text-slate-500">
                {module.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={module.status} />
            <ActionButton
              action={moveContentAction}
              fields={{
                kind: 'module',
                id: module.id,
                direction: 'up',
                courseSlug,
              }}
              disabled={index === 0}
              label={`Move ${module.title} earlier`}
            >
              ↑
            </ActionButton>
            <ActionButton
              action={moveContentAction}
              fields={{
                kind: 'module',
                id: module.id,
                direction: 'down',
                courseSlug,
              }}
              disabled={index === total - 1}
              label={`Move ${module.title} later`}
            >
              ↓
            </ActionButton>
            <ActionButton
              action={setStatusAction}
              fields={{
                kind: 'module',
                id: module.id,
                status: nextStatus,
                courseSlug,
              }}
              label={
                module.status === 'active'
                  ? `Unpublish ${module.title}`
                  : `Publish ${module.title}`
              }
            >
              {module.status === 'active' ? 'Unpublish' : 'Publish'}
            </ActionButton>
          </div>
        </div>

        {module.lessons.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 italic">
            No lessons in this module yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {module.lessons.map((lesson, lessonIndex) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={lessonIndex}
                total={module.lessons.length}
                courseSlug={courseSlug}
              />
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonLink
            href={`/admin/content/${courseSlug}/lessons/new?moduleId=${module.id}`}
            variant="secondary"
            size="sm"
          >
            Add a lesson
          </ButtonLink>
          <form action={deleteContentAction} className="inline">
            <input type="hidden" name="kind" value="module" />
            <input type="hidden" name="id" value={module.id} />
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <ConfirmButton
              message={
                module.lessons.length > 0
                  ? `Delete "${module.title}" and its ${module.lessons.length} ${
                      module.lessons.length === 1 ? 'lesson' : 'lessons'
                    }, including all their written content? This cannot be undone.`
                  : `Delete the module "${module.title}"? This cannot be undone.`
              }
            >
              Delete module
            </ConfirmButton>
          </form>
        </div>
      </CardBody>
    </Card>
  )
}

function LessonRow({
  lesson,
  index,
  total,
  courseSlug,
}: {
  lesson: AdminLesson
  index: number
  total: number
  courseSlug: string
}) {
  const time = formatStudyTime(lesson.estimated_minutes)
  const nextStatus = lesson.status === 'active' ? 'draft' : 'active'

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/content/${courseSlug}/lessons/${lesson.id}`}
          className="font-medium text-navy-700 hover:underline"
        >
          {lesson.title}
        </Link>
        <span className="ml-2 text-xs text-slate-400">
          /{lesson.slug}
          {time ? ` · ${time}` : ''}
        </span>
        {!lesson.hasBody && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
            No content
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={lesson.status} />
        <ActionButton
          action={moveContentAction}
          fields={{
            kind: 'lesson',
            id: lesson.id,
            direction: 'up',
            courseSlug,
          }}
          disabled={index === 0}
          label={`Move ${lesson.title} earlier`}
        >
          ↑
        </ActionButton>
        <ActionButton
          action={moveContentAction}
          fields={{
            kind: 'lesson',
            id: lesson.id,
            direction: 'down',
            courseSlug,
          }}
          disabled={index === total - 1}
          label={`Move ${lesson.title} later`}
        >
          ↓
        </ActionButton>
        <ActionButton
          action={setStatusAction}
          fields={{
            kind: 'lesson',
            id: lesson.id,
            status: nextStatus,
            courseSlug,
          }}
          label={
            lesson.status === 'active'
              ? `Unpublish ${lesson.title}`
              : `Publish ${lesson.title}`
          }
        >
          {lesson.status === 'active' ? 'Unpublish' : 'Publish'}
        </ActionButton>
      </div>
    </li>
  )
}
