'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
} from '@/lib/validation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, FormActions, Input } from '@/components/ui/Form'

/**
 * Sets a new password, for somebody arriving from a reset email.
 *
 * How the link works: Supabase puts a recovery token in the URL, and the
 * client library exchanges it for a short-lived session before this component
 * mounts. So by the time we are here the visitor is, briefly, signed in — and
 * `updateUser` is all that is needed.
 *
 * Which means the page must establish that a recovery session actually exists
 * before showing the form. Without that check, somebody who navigates here
 * directly gets a password form that fails on submit for reasons they cannot
 * act on, and — worse — anybody who left themselves signed in on a shared
 * machine would find a form that changes their password without asking for
 * the old one.
 */
export function ResetPasswordForm() {
  const router = useRouter()

  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string
    confirm?: string
  }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // PASSWORD_RECOVERY fires when the library has consumed the token from the
    // URL. Listening is more reliable than reading the session immediately,
    // because the exchange may not have finished when this effect first runs.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady('ok')
    })

    supabase.auth.getSession().then(({ data }) => {
      setReady((current) =>
        current === 'ok' ? current : data.session ? 'ok' : 'invalid',
      )
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors: { password?: string; confirm?: string } = {}
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (confirm !== password) {
      errors.confirm = 'The two passwords do not match.'
    }
    setFieldErrors(errors)
    if (errors.password || errors.confirm) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setFormError(authErrorMessage(error))
        return
      }

      setDone(true)
      router.refresh()
    } catch (error) {
      console.error('[auth] password update failed', error)
      setFormError(
        'We could not reach the authentication service. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (ready === 'checking') {
    return <p className="text-sm text-slate-600">Checking your link…</p>
  }

  if (ready === 'invalid') {
    return (
      <div className="space-y-5">
        <Alert variant="warning" title="This link is no longer valid">
          Reset links expire, and each one can only be used once. Request a new
          one and use it straight away.
        </Alert>
        <p className="text-center text-sm text-slate-600">
          <Link
            href="/forgot-password"
            className="text-navy-700 font-medium hover:underline"
          >
            Send a new reset link
          </Link>
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Password changed">
          You are signed in with the new password.
        </Alert>
        <FormActions>
          <Button size="lg" fullWidth onClick={() => router.push('/dashboard')}>
            Go to the dashboard
          </Button>
        </FormActions>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Field
        label="New password"
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(fieldErrors.password)}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm"
        error={fieldErrors.confirm}
        required
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          invalid={Boolean(fieldErrors.confirm)}
        />
      </Field>

      <FormActions>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel="Saving…"
        >
          Set new password
        </Button>
      </FormActions>
    </form>
  )
}
