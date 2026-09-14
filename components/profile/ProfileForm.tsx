'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  initialProfileFormState,
  updateProfileAction,
} from '@/app/dashboard/profile/actions'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, FormActions, Input, ReadOnlyValue } from '@/components/ui/Form'

type ProfileFormProps = {
  firstName: string
  lastName: string
  email: string
  role: string
}

/**
 * Editable name fields; everything else is read-only.
 *
 * Submits to a Server Action, so it works before hydration and the rules are
 * applied on the server regardless of what the browser sends.
 */
export function ProfileForm({
  firstName,
  lastName,
  email,
  role,
}: ProfileFormProps) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    initialProfileFormState,
  )

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'success' && state.message && (
        <Alert variant="success">{state.message}</Alert>
      )}
      {state.status === 'error' && state.message && (
        <Alert variant="error">{state.message}</Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          htmlFor="firstName"
          error={state.fieldErrors.firstName}
          required
        >
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={firstName}
            invalid={Boolean(state.fieldErrors.firstName)}
          />
        </Field>

        <Field
          label="Last name"
          htmlFor="lastName"
          error={state.fieldErrors.lastName}
          required
        >
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={lastName}
            invalid={Boolean(state.fieldErrors.lastName)}
          />
        </Field>
      </div>

      <Field label="Email address" htmlFor="email">
        <ReadOnlyValue note="Your email address is managed by your sign-in credentials and cannot be changed here yet.">
          {email}
        </ReadOnlyValue>
      </Field>

      <Field label="Account type" htmlFor="role">
        <ReadOnlyValue note="Account type is set by an administrator.">
          {role}
        </ReadOnlyValue>
      </Field>

      <FormActions>
        <SubmitButton />
      </FormActions>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      loading={pending}
      loadingLabel="Saving…"
      disabled={pending}
    >
      Save changes
    </Button>
  )
}
