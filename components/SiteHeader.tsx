import Link from 'next/link'
import { getAuthContext } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/env'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'
import { SignOutButton } from '@/components/SignOutButton'
import { MobileMenu } from '@/components/MobileMenu'

const PUBLIC_LINKS = [
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

/**
 * Marketing-site header.
 *
 * A Server Component, so the signed-in state is resolved on the server from a
 * verified session rather than flashing "Sign in" and then swapping after
 * hydration.
 */
export async function SiteHeader() {
  // When Supabase is not configured the public pages should still render, so
  // the header degrades to its signed-out state instead of throwing.
  const auth = isSupabaseConfigured() ? await getAuthContext() : null
  const isAdmin = auth?.profile?.role === 'admin'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-navy-800 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {auth ? (
            <>
              {isAdmin && (
                <ButtonLink href="/admin" variant="ghost" size="sm">
                  Admin
                </ButtonLink>
              )}
              <ButtonLink href="/dashboard" variant="secondary" size="sm">
                Dashboard
              </ButtonLink>
              <SignOutButton variant="ghost" />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm">
                Create account
              </ButtonLink>
            </>
          )}
        </div>

        <MobileMenu
          links={PUBLIC_LINKS}
          signedIn={Boolean(auth)}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  )
}
