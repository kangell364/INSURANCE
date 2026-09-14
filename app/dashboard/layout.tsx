import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { displayName } from '@/types'
import { DashboardNav, type NavItem } from '@/components/DashboardNav'
import { SignOutButton } from '@/components/SignOutButton'
import { Logo } from '@/components/Logo'
import { Alert } from '@/components/ui/Alert'

const STUDENT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/courses', label: 'My courses' },
  { href: '/dashboard/progress', label: 'Progress', upcoming: true },
  { href: '/dashboard/exams', label: 'Practice exams', upcoming: true },
  { href: '/dashboard/profile', label: 'Profile' },
]

/**
 * Student area shell.
 *
 * `requireAuth()` runs on the server for every page under /dashboard and
 * redirects anonymous visitors to /login. The middleware performs the same
 * redirect earlier for a faster response, but this check is the one that
 * actually guarantees it: layouts cannot be skipped by a client, and even if
 * both were bypassed, RLS would return no rows.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, profileError } = await requireAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {displayName(profile)}
            </span>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-navy-700 hover:bg-navy-50 rounded-md px-3 py-2 text-sm font-medium"
              >
                Admin
              </Link>
            )}
            <SignOutButton variant="ghost" />
          </div>
        </div>
      </header>

      <div className="container-page flex-1 py-8">
        <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
          <aside>
            <DashboardNav items={STUDENT_NAV} label="Student" />
          </aside>

          <main id="main" className="min-w-0">
            {profileError && (
              <div className="mb-6">
                <Alert variant="warning" title="Profile unavailable">
                  {profileError}
                </Alert>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
