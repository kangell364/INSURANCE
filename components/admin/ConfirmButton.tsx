'use client'

import { useFormStatus } from 'react-dom'
import { Button, type ButtonVariant } from '@/components/ui/Button'

/**
 * A submit button that asks before it goes through.
 *
 * Deletions here cascade — removing a module removes its lessons and their
 * bodies with it — and there is no undo. The confirmation names what will be
 * lost rather than asking "are you sure?", because the second question is one
 * people answer without reading.
 *
 * `window.confirm` blocks the event loop and is unfashionable. It is also the
 * one dialog that cannot be dismissed by a stray click, renders before
 * hydration finishes, and needs no focus-trap of its own. For a destructive,
 * infrequent action that is the right trade; a prettier modal would be more
 * code and easier to get wrong.
 */
export function ConfirmButton({
  message,
  children,
  variant = 'dangerQuiet',
  size = 'sm',
}: {
  message: string
  children: React.ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      loading={pending}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {children}
    </Button>
  )
}

/** A plain submit button that shows progress. */
export function SubmitButton({
  children,
  loadingLabel = 'Saving…',
  variant = 'primary',
  size = 'md',
}: {
  children: React.ReactNode
  loadingLabel?: string
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      loading={pending}
      loadingLabel={loadingLabel}
      disabled={pending}
    >
      {children}
    </Button>
  )
}
