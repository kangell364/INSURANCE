'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeReturnPath } from '@/lib/navigation'
import {
  authErrorMessage,
  hasErrors,
  validateLogin,
  type FieldErrors,
  type LoginFields,
} from '@/lib/validation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, FormActions, Input } from '@/components/ui/Form'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginFields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // `next` is attacker-controllable (it is just a query string), so it is
  // normalised to a same-origin path before we ever navigate to it.
  const nextPath = safeReturnPath(searchParams.get('next'))
  const justRegistered = searchParams.get('registered') === '1'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = validateLogin({ email, password })
    setFieldErrors(errors)
    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setFormError(authErrorMessage(error))
        return
      }

      // refresh() re-runs the Server Components with the new session cookie,
      // so the header and the dashboard render as signed in immediately.
      router.replace(nextPath)
      router.refresh()
    } catch (error) {
      console.error('[auth] sign-in failed', error)
      setFormError(
        'We could not reach the authentication service. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {justRegistered && (
        <Alert variant="success" title="Account created">
          Sign in with the email address and password you just chose.
        </Alert>
      )}

      {formError && <Alert variant="error">{formError}</Alert>}

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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={fieldErrors.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
      </Field>

      <FormActions>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel="Signing in…"
        >
          Sign in
        </Button>
      </FormActions>

      <p className="text-center text-sm text-slate-600">
        Do not have an account?{' '}
        <Link href="/signup" className="text-navy-700 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
