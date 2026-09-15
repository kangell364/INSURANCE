'use client'

import { useActionState } from 'react'
import { saveTopicAction } from '@/app/admin/content/actions'
import { idleState } from '@/lib/action-state'
import { Alert } from '@/components/ui/Alert'
import { Card, CardBody } from '@/components/ui/Card'
import { Field, FormActions, Input, Select } from '@/components/ui/Form'
import { SubmitButton } from '@/components/admin/ConfirmButton'

type TopicFormProps = {
  courseId: string
  courseSlug: string
  /** Top-level topics only — the schema allows one level of nesting. */
  parentOptions: { id: string; code: string; name: string }[]
  topic?: {
    id: string
    code: string
    name: string
    parentTopicId: string | null
    blueprintWeight: number | null
  }
}

export function TopicForm({
  courseId,
  courseSlug,
  parentOptions,
  topic,
}: TopicFormProps) {
  const [state, formAction] = useActionState(saveTopicAction, idleState)

  // A topic cannot be its own parent; the database rejects it, but offering
  // it in the dropdown at all is a trap rather than a safeguard.
  const parents = parentOptions.filter((option) => option.id !== topic?.id)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      {topic && <input type="hidden" name="topicId" value={topic.id} />}

      {state.status === 'error' && state.message && (
        <Alert variant="error" title="Not saved">
          {state.message}
        </Alert>
      )}

      <Card>
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Blueprint code"
              htmlFor="code"
              error={state.fieldErrors.code}
              hint="As published by the state, for example GL.01.02."
              required
            >
              <Input
                id="code"
                name="code"
                defaultValue={topic?.code ?? ''}
                invalid={Boolean(state.fieldErrors.code)}
              />
            </Field>

            <Field
              label="Weighting (%)"
              htmlFor="blueprintWeight"
              error={state.fieldErrors.blueprintWeight}
              hint="The published percentage of the exam, if the blueprint gives one."
            >
              <Input
                id="blueprintWeight"
                name="blueprintWeight"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={topic?.blueprintWeight ?? ''}
                invalid={Boolean(state.fieldErrors.blueprintWeight)}
              />
            </Field>
          </div>

          <Field
            label="Topic name"
            htmlFor="name"
            error={state.fieldErrors.name}
            required
          >
            <Input
              id="name"
              name="name"
              defaultValue={topic?.name ?? ''}
              invalid={Boolean(state.fieldErrors.name)}
            />
          </Field>

          <Field
            label="Parent topic"
            htmlFor="parentTopicId"
            hint="Leave blank for a top-level topic. Topics nest one level only."
          >
            <Select
              id="parentTopicId"
              name="parentTopicId"
              defaultValue={topic?.parentTopicId ?? ''}
            >
              <option value="">None — top level</option>
              {parents.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} — {option.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <FormActions>
        <SubmitButton>{topic ? 'Save changes' : 'Create topic'}</SubmitButton>
        <a
          href={`/admin/content/${courseSlug}/topics`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Cancel
        </a>
      </FormActions>
    </form>
  )
}
