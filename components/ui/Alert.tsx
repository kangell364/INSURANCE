import type { ReactNode } from 'react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const VARIANTS: Record<AlertVariant, { box: string; icon: string }> = {
  info: {
    box: 'border-navy-200 bg-navy-50 text-navy-900',
    icon: 'text-navy-600',
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
  },
}

const ICON_PATHS: Record<AlertVariant, string> = {
  info: 'M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  success: 'm9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  error: 'M12 9v3.75m0 3.75h.007M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

type AlertProps = {
  variant?: AlertVariant
  title?: ReactNode
  children?: ReactNode
}

export function Alert({ variant = 'info', title, children }: AlertProps) {
  const styles = VARIANTS[variant]

  return (
    <div
      // Errors interrupt; everything else is announced politely.
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${styles.box}`}
    >
      <svg
        className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICON_PATHS[variant]} />
      </svg>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  )
}
