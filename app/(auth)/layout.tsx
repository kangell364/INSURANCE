import Link from 'next/link'
import { Logo } from '@/components/Logo'

/**
 * Rendered per request so that `isSupabaseConfigured()` reflects the runtime
 * environment. If these pages were prerendered, an image built without the
 * Supabase variables would serve a permanent "not configured" message even
 * after the variables were supplied at deploy time.
 */
export const dynamic = 'force-dynamic'

/** Centred, distraction-free shell for /login and /signup. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="container-page flex h-16 items-center">
        <Logo />
      </header>

      <main
        id="main"
        className="flex flex-1 items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="container-page py-6 text-center text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-700">
          Back to the main site
        </Link>
      </footer>
    </div>
  )
}
