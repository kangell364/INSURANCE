import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dangerQuiet'
  | 'accent'
  | 'inverse'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Every colour combination a button can have lives here, as a complete set.
 *
 * Do NOT recolour a button by passing conflicting utilities through
 * `className`. Tailwind emits each utility once, in its own order, so
 * `className="bg-transparent"` layered over a variant's `bg-white` is decided
 * by the stylesheet, not by the order of the strings — which silently produced
 * a white-on-white, invisible button in the hero. Add a variant instead.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy-800 text-white hover:bg-navy-900',
  secondary:
    'border border-navy-200 bg-white text-navy-800 hover:bg-navy-50 hover:border-navy-300',
  ghost: 'text-navy-700 hover:bg-navy-50',
  // Filled red: for the confirming step of a destructive flow, where the
  // destructive act IS the purpose of the screen.
  danger: 'bg-red-600 text-white hover:bg-red-700',
  // Outlined red: for a destructive action sitting beside ordinary ones.
  //
  // A saturated fill is an attractor — it pulls the eye and, on a crowded
  // card, the cursor. "Delete module" rendered in filled red next to "Add a
  // lesson" made the irreversible action the most prominent thing on the
  // card, which is precisely backwards. This reads clearly as destructive
  // without competing for the click.
  dangerQuiet:
    'border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50',
  // The single high-emphasis call to action, for use on a dark ground.
  accent: 'bg-accent-500 text-white hover:bg-accent-600',
  // Outlined, for a secondary action sitting on a dark ground.
  inverse:
    'border border-white/30 bg-transparent text-white hover:border-white/50 hover:bg-white/10',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

function classesFor(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  className?: string,
): string {
  return [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Renders a spinner and disables the button. */
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classesFor(variant, size, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: ReactNode
}

/** A link styled as a button. Use for navigation, never for actions. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={classesFor(variant, size, fullWidth, className)}
      {...props}
    >
      {children}
    </Link>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}
