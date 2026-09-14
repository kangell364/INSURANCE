import { Skeleton, LoadingCards } from '@/components/ui/States'

export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading admin dashboard">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <LoadingCards count={6} />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
