import { Skeleton, LoadingCards } from '@/components/ui/States'

export default function CoursesLoading() {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <LoadingCards count={3} />
    </div>
  )
}
