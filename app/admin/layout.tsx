import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { SignOutButton } from '@/components/SignOutButton'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

/**
 * Admin shell.
 *
 * Authorization happens here, on the server, on every request:
 *   * `requireAdmin()` verifies the JWT with the Auth server, then reads the
 *     role from the `profiles` table.
 *   * A non-admin gets the access-denied screen below and none of the admin
 *     children are ever rendered or sent to the browser.
 *
 * Nothing about this depends on the client. Hiding the "Admin" link in the
 * header is cosmetic; this check is the control. And even if it were removed,
 * every admin-only query would still come back empty because the RLS policies
 * gate on `public.is_admin()` in the database.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await requireAdmin()

  if (!context) return <AccessDenied />

  return (
    <div className="bg-navy-950 flex min-h-screen flex-col">
      <header className="border-b border-white/10">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo href="/admin" tone="light" />
            <span className="bg-accent-500/20 text-accent-200 hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Student view
            </Link>
            <SignOutButton variant="ghost" />
          </div>
        </div>
      </header>

      <div className="flex-1 bg-slate-100">
        <main id="main" className="container-page py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="container-page flex h-16 items-center">
        <Logo />
      </header>
      <main
        id="main"
        className="flex flex-1 items-center justify-center px-4 py-10"
      >
        <Card className="w-full max-w-lg">
          <CardBody className="py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
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
                <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="mt-5 text-xl">Access denied</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your account does not have administrator permissions. If you
              believe this is a mistake, contact your platform administrator.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/dashboard">Go to my dashboard</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Back to the main site
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
