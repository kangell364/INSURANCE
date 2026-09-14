'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { hasErrors, validateProfile, type ProfileFields } from '@/lib/validation'
import type { FieldErrors } from '@/lib/validation'

export type ProfileFormState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: FieldErrors<ProfileFields>
}

export const initialProfileFormState: ProfileFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

/**
 * Updates the signed-in user's own name.
 *
 * Three independent layers decide what this can change:
 *   1. The `id` is taken from the verified session, never from the form. A
 *      hidden field naming another user would be ignored.
 *   2. Only `first_name` and `last_name` are read out of the FormData, so
 *      extra fields such as `role` are dropped before the query is built.
 *   3. The database grants `authenticated` UPDATE on exactly those two
 *      columns, and RLS restricts the row to the caller's own. Even a
 *      hand-written request straight to PostgREST cannot do more than this.
 */
export async function updateProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getUser()
  if (!user) {
    return {
      status: 'error',
      message: 'Your session has expired. Please sign in again.',
      fieldErrors: {},
    }
  }

  const firstName = String(formData.get('firstName') ?? '')
  const lastName = String(formData.get('lastName') ?? '')

  // Server-side validation. The client runs the same rules for immediate
  // feedback, but this is the copy that decides.
  const fieldErrors = validateProfile({ firstName, lastName })
  if (hasErrors(fieldErrors)) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('[profile] update failed', {
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    return {
      status: 'error',
      message: 'We could not save your changes. Please try again.',
      fieldErrors: {},
    }
  }

  // The name is shown in the dashboard header too, so refresh the whole shell.
  revalidatePath('/dashboard', 'layout')

  return {
    status: 'success',
    message: 'Your profile has been updated.',
    fieldErrors: {},
  }
}
