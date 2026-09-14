import { Skeleton, LoadingCards } from '@/components/ui/States'

/** Shown while the dashboard's server data resolves. Never a blank screen. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <LoadingCards count={3} />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
