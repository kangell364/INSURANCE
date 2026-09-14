import { ButtonLink } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="text-navy-500 text-xs font-semibold tracking-widest uppercase">
          404
        </p>
        <h1 className="mt-2 text-2xl">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          The page you were looking for does not exist, or it may have moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/courses" variant="secondary">
            Browse courses
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
