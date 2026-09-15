'use client'

import { useActionState, useState } from 'react'
import { saveLessonAction } from '@/app/admin/content/actions'
import { idleState } from '@/lib/action-state'
import { Markdown } from '@/components/Markdown'
import { slugify } from '@/lib/validation'
import { Alert } from '@/components/ui/Alert'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, FormActions, Input, Select, Textarea } from '@/components/ui/Form'
import { SubmitButton } from '@/components/admin/ConfirmButton'
import type { ContentStatus } from '@/types'

export type LessonFormTopic = { id: string; code: string; name: string }

type LessonFormProps = {
  courseSlug: string
  moduleId: string
  moduleTitle: string
  topics: LessonFormTopic[]
  lesson?: {
    id: string
    title: string
    slug: string
    summary: string | null
    status: ContentStatus
    estimatedMinutes: number | null
    body: string
    topicIds: string[]
  }
}

/**
 * The lesson editor.
 *
 * Two behaviours are worth explaining:
 *
 * 1. The slug follows the title only while it has not been edited by hand.
 *    A slug is part of a public URL, so once an author has chosen one,
 *    retyping the title must not silently change it and break every link
 *    already pointing there. For a NEW lesson the slug is empty and tracking
 *    is helpful; the moment the author types in the slug field, or the lesson
 *    already exists, it stops.
 *
 * 2. The preview renders through the same `Markdown` component the student
 *    sees. Not a similar one — the same one. A preview that renders through a
 *    second code path is a preview that can lie, and the whole point of it is
 *    to be trusted.
 */
export function LessonForm({
  courseSlug,
  moduleId,
  moduleTitle,
  topics,
  lesson,
}: LessonFormProps) {
  const [state, formAction] = useActionState(saveLessonAction, idleState)

  const [title, setTitle] = useState(lesson?.title ?? '')
  const [slug, setSlug] = useState(lesson?.slug ?? '')
  const [body, setBody] = useState(lesson?.body ?? '')
  const [showPreview, setShowPreview] = useState(false)

  // An existing lesson's slug is already public, so it never auto-follows.
  const [slugTracksTitle, setSlugTracksTitle] = useState(!lesson)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="moduleId" value={moduleId} />
      {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}

      {state.status === 'error' && state.message && (
        <Alert variant="error" title="Not saved">
          {state.message}
        </Alert>
      )}

      <Card>
        <CardBody className="space-y-5">
          <Field
            label="Lesson title"
            htmlFor="title"
            error={state.fieldErrors.title}
            required
          >
            <Input
              id="title"
              name="title"
              value={title}
              invalid={Boolean(state.fieldErrors.title)}
              onChange={(event) => {
                setTitle(event.target.value)
                if (slugTracksTitle) setSlug(slugify(event.target.value))
              }}
            />
          </Field>

          <Field
            label="Web address"
            htmlFor="slug"
            error={state.fieldErrors.slug}
            hint={
              <>
                Appears in the link students share:{' '}
                <code className="text-slate-600">
                  /dashboard/courses/{courseSlug}/{slug || 'your-lesson'}
                </code>
                {lesson && ' — changing it breaks existing links.'}
              </>
            }
            required
          >
            <Input
              id="slug"
              name="slug"
              value={slug}
              invalid={Boolean(state.fieldErrors.slug)}
              onChange={(event) => {
                // Any manual edit permanently detaches it from the title.
                setSlugTracksTitle(false)
                setSlug(event.target.value)
              }}
            />
          </Field>

          <Field
            label="Summary"
            htmlFor="summary"
            error={state.fieldErrors.summary}
            hint="One or two sentences. Shown on the PUBLIC syllabus, so keep exam content out of it."
          >
            <Textarea
              id="summary"
              name="summary"
              rows={2}
              defaultValue={lesson?.summary ?? ''}
              invalid={Boolean(state.fieldErrors.summary)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Reading time (minutes)"
              htmlFor="estimatedMinutes"
              error={state.fieldErrors.estimatedMinutes}
              hint="Optional. Shown to students planning a session."
            >
              <Input
                id="estimatedMinutes"
                name="estimatedMinutes"
                type="number"
                min={1}
                max={600}
                defaultValue={lesson?.estimatedMinutes ?? ''}
                invalid={Boolean(state.fieldErrors.estimatedMinutes)}
              />
            </Field>

            <Field
              label="Status"
              htmlFor="status"
              hint="Draft lessons are invisible to students, body included."
            >
              <Select
                id="status"
                name="status"
                defaultValue={lesson?.status ?? 'draft'}
              >
                <option value="draft">Draft</option>
                <option value="active">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
          </div>

          <p className="text-sm text-slate-500">
            In module: <span className="font-medium">{moduleTitle}</span>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Lesson content</h2>
              <p className="mt-1 text-sm text-slate-500">
                Markdown. Only enrolled students can read this.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview((shown) => !shown)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              aria-pressed={showPreview}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {/* The textarea stays mounted while previewing — unmounting it would
              drop the field from the form, and an author who hits Save from
              the preview would silently wipe the body. */}
          <div hidden={showPreview}>
            <Field label="Markdown" htmlFor="body">
              <Textarea
                id="body"
                name="body"
                rows={20}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="font-mono text-[13px] leading-relaxed"
                placeholder={'# Heading\n\nA paragraph with **bold** text.\n\n- A list item\n- Another\n\n> A quotation.'}
              />
            </Field>
            <p className="mt-2 text-xs text-slate-500">
              Supported: <code># headings</code>, <code>**bold**</code>,{' '}
              <code>*italic*</code>, <code>- lists</code>,{' '}
              <code>1. numbered lists</code>, <code>&gt; quotes</code>,{' '}
              <code>`code`</code>, <code>[links](https://example.com)</code> and{' '}
              <code>---</code>. HTML is shown as plain text, never rendered.
            </p>
          </div>

          {showPreview && (
            // Named as a region so assistive technology announces what this
            // is when the author toggles into it, rather than dropping them
            // into unlabelled prose.
            <div
              role="region"
              aria-label="Lesson preview"
              className="rounded-(--radius-card) border border-slate-200 bg-white p-5"
            >
              {/* Rendered by the component the student sees, so the preview
                  cannot disagree with the page. */}
              <Markdown source={body} />
            </div>
          )}
        </CardBody>
      </Card>

      {topics.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Exam topics covered</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tagging is what lets a readiness score say &ldquo;revise these
              lessons&rdquo; instead of only naming a weak topic. An untagged
              lesson can never be recommended.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      name="topicIds"
                      value={topic.id}
                      defaultChecked={lesson?.topicIds.includes(topic.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 text-sm">
                      <span className="font-mono text-xs text-slate-400">
                        {topic.code}
                      </span>{' '}
                      <span className="text-slate-800">{topic.name}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <FormActions>
        <SubmitButton>
          {lesson ? 'Save changes' : 'Create lesson'}
        </SubmitButton>
        <a
          href={`/admin/content/${courseSlug}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Cancel
        </a>
      </FormActions>
    </form>
  )
}
