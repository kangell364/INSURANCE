'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, isValidEmail } from '@/lib/validation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, FormActions, Input } from '@/components/ui/Form'

/**
 * Requests a password reset email.
 *
 * The success screen is shown whether or not the address is registered, and
 * that is deliberate. A form that says "no account with that email" is an
 * account enumeration oracle: anybody can test addresses against the user list
 * and learn who has bought the course. `authErrorMessage` takes the same line
 * on the sign-in form, and the two must agree or the difference between them
 * becomes the oracle instead.
 *
 * The cost is real — somebody who mistypes their address waits for an email
 * that will never arrive — so the confirmation says exactly which address was
 * used, which is the most help that can be given without disclosing anything.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setFieldError('Enter your email address.')
      return
    }
    if (!isValidEmail(trimmed)) {
      setFieldError('Enter a valid email address.')
      return
    }
    setFieldError(undefined)

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        // Where the link in the email lands. Must be registered in Supabase's
        // Redirect URLs allow-list, or the link bounces to the Site URL and
        // the user never reaches the form.
        redirectTo: `${window.location.origin}/reset-password`,
      })

      // A rate-limit IS worth surfacing: it is about the request, not about
      // whether the account exists, so it discloses nothing.
      if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
        setFormError(authErrorMessage(error))
        return
      }

      // Every other outcome, including "no such user", shows success.
      setSent(true)
    } catch (error) {
      console.error('[auth] password reset request failed', error)
      setFormError(
        'We could not reach the authentication service. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Check your email">
          If an account exists for <strong>{email.trim()}</strong>, a link to
          reset the password is on its way. It expires after a short time, so
          use it soon.
        </Alert>
        <p className="text-sm text-slate-600">
          Nothing arrived? Check the spam folder, and confirm the address above
          is the one you registered with.
        </p>
        <p className="text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="text-navy-700 font-medium hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Field
        label="Email address"
        htmlFor="email"
        error={fieldError}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? 'email-error' : undefined}
        />
      </Field>

      <FormActions>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel="Sending…"
        >
          Send reset link
        </Button>
      </FormActions>

      <p className="text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link
          href="/login"
          className="text-navy-700 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
