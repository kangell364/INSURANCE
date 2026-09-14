'use client'

import { useEffect } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'

/**
 * Root error boundary.
 *
 * Shows a recovery path, never the underlying message. In production Next
 * already redacts the error passed here, but the rule holds regardless: stack
 * traces and database errors belong in the server log, not on a user's screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] unhandled error', {
      digest: error.digest,
      message: error.message,
    })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="text-navy-500 text-xs font-semibold tracking-widest uppercase">
          Error
        </p>
        <h1 className="mt-2 text-2xl">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600">
          We hit an unexpected problem loading this page. Trying again often
          resolves it.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">
            Reference: <code>{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
