'use client'

import { useActionState } from 'react'
import { saveModuleAction } from '@/app/admin/content/actions'
import { idleState } from '@/lib/action-state'
import { Alert } from '@/components/ui/Alert'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, FormActions, Input, Select, Textarea } from '@/components/ui/Form'
import { SubmitButton } from '@/components/admin/ConfirmButton'
import type { ContentStatus } from '@/types'

type ModuleFormProps = {
  courseId: string
  courseSlug: string
  module?: {
    id: string
    title: string
    description: string | null
    status: ContentStatus
  }
}

/**
 * Create or edit a module.
 *
 * There is no `position` field. Ordering is assigned by the server on create
 * and changed with the up/down controls on the content index — a number an
 * author types by hand is a number two modules can share, and the resulting
 * constraint violation is not a useful thing to show someone writing a course.
 */
export function ModuleForm({ courseId, courseSlug, module }: ModuleFormProps) {
  const [state, formAction] = useActionState(saveModuleAction, idleState)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      {module && <input type="hidden" name="moduleId" value={module.id} />}

      {state.status === 'error' && state.message && (
        <Alert variant="error" title="Not saved">
          {state.message}
        </Alert>
      )}

      <Card>
        <CardBody className="space-y-5">
          <Field
            label="Module title"
            htmlFor="title"
            error={state.fieldErrors.title}
            required
          >
            <Input
              id="title"
              name="title"
              defaultValue={module?.title ?? ''}
              invalid={Boolean(state.fieldErrors.title)}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={state.fieldErrors.description}
            hint="Optional. Shown on the PUBLIC syllabus beneath the module title."
          >
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={module?.description ?? ''}
              invalid={Boolean(state.fieldErrors.description)}
            />
          </Field>

          <Field
            label="Status"
            htmlFor="status"
            hint="Unpublishing a module hides every lesson inside it, including their content."
          >
            <Select
              id="status"
              name="status"
              defaultValue={module?.status ?? 'draft'}
            >
              <option value="draft">Draft</option>
              <option value="active">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      <FormActions>
        <SubmitButton>{module ? 'Save changes' : 'Create module'}</SubmitButton>
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
