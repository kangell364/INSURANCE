import type { ReactNode } from 'react'
import { Card } from './Card'

/* ==========================================================================
   Empty, loading and placeholder states.

   Every list in the product has a defined "nothing here yet" rendering, and
   every async boundary has a skeleton. A blank screen is always a bug.
   ========================================================================== */

type EmptyStateProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="bg-navy-50 text-navy-500 flex h-12 w-12 items-center justify-center rounded-full">
        {icon ?? <DocumentIcon />}
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Marks a section as intentionally not built yet.
 *
 * Phase 1 ships the shell for several features whose engines land later. They
 * are labelled explicitly rather than filled with invented statistics, so the
 * dashboard never implies progress data that does not exist.
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string
  description: string
  phase?: string
}) {
  return (
    <Card className="h-full">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600">
            {phase ?? 'Coming soon'}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </Card>
  )
}

/** Skeleton block used by route-level loading.tsx files. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/70 ${className}`}
      aria-hidden="true"
    />
  )
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <div className="space-y-3 px-5 py-5 sm:px-6">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </Card>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function LoadingPage({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
      role="status"
    >
      <svg
        className="text-navy-500 h-6 w-6 animate-spin"
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
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function DocumentIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}
