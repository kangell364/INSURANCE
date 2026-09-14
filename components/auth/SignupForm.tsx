'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  hasErrors,
  validateSignup,
  type FieldErrors,
  type SignupFields,
} from '@/lib/validation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, FormActions, Input } from '@/components/ui/Form'

/**
 * Public registration.
 *
 * There is deliberately no role selector. Every public registration becomes a
 * student, and the role is set by a database trigger — the `first_name` /
 * `last_name` metadata below is the only thing this form can influence, and
 * the trigger trims and length-caps even that. A crafted request adding
 * `role: 'admin'` to the metadata has no effect.
 */
export function SignupForm() {
  const router = useRouter()

  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignupFields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  function update(field: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setValues((current) => ({ ...current, [field]: value }))
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = validateSignup(values)
    setFieldErrors(errors)
    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            first_name: values.firstName.trim(),
            last_name: values.lastName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setFormError(authErrorMessage(error))
        return
      }

      // When email confirmation is switched on, signUp returns a user with no
      // session. Show the "check your inbox" screen rather than bouncing the
      // user to a dashboard they cannot reach yet.
      if (!data.session) {
        setAwaitingConfirmation(true)
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('[auth] sign-up failed', error)
      setFormError(
        'We could not reach the authentication service. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Check your email">
          If that address can be registered, we have sent a confirmation link
          to <strong>{values.email.trim()}</strong>. Open it to activate your
          account, then sign in.
        </Alert>
        <Link
          href="/login"
          className="text-navy-700 block text-center text-sm font-medium hover:underline"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          htmlFor="firstName"
          error={fieldErrors.firstName}
          required
        >
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={update('firstName')}
            invalid={Boolean(fieldErrors.firstName)}
          />
        </Field>

        <Field
          label="Last name"
          htmlFor="lastName"
          error={fieldErrors.lastName}
          required
        >
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={update('lastName')}
            invalid={Boolean(fieldErrors.lastName)}
          />
        </Field>
      </div>

      <Field
        label="Email address"
        htmlFor="email"
        error={fieldErrors.email}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          invalid={Boolean(fieldErrors.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={fieldErrors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={update('password')}
          invalid={Boolean(fieldErrors.password)}
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={fieldErrors.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          invalid={Boolean(fieldErrors.confirmPassword)}
        />
      </Field>

      <FormActions>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel="Creating account…"
        >
          Create account
        </Button>
      </FormActions>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="text-navy-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
