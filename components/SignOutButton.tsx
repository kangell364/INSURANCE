import type { ButtonVariant } from '@/components/ui/Button'
import { Button } from '@/components/ui/Button'

/**
 * Sign out via a real form POST to a Route Handler.
 *
 * Deliberately not a Client Component: a plain form works with JavaScript
 * disabled, needs no client bundle, and the POST (rather than a GET link)
 * means a prefetch or a crawler can never sign the user out by accident.
 */
export function SignOutButton({
  variant = 'secondary',
  fullWidth = false,
}: {
  variant?: ButtonVariant
  fullWidth?: boolean
}) {
  return (
    <form action="/auth/signout" method="post" className={fullWidth ? 'w-full' : ''}>
      <Button type="submit" variant={variant} size="sm" fullWidth={fullWidth}>
        Sign out
      </Button>
    </form>
  )
}
