'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SignOutButton } from '@/components/SignOutButton'

type MobileMenuProps = {
  links: { href: string; label: string }[]
  signedIn: boolean
  isAdmin: boolean
}

/**
 * Small-screen navigation.
 *
 * The only Client Component in the header — it exists purely for the
 * open/closed toggle. Everything it renders is also reachable from the
 * server-rendered desktop nav.
 */
export function MobileMenu({ links, signedIn, isAdmin }: MobileMenuProps) {
  const pathname = usePathname()

  // The panel is open only for the route it was opened on. Deriving it this
  // way means a client-side navigation closes it for free, with no effect and
  // no cascading render.
  const [openForPath, setOpenForPath] = useState<string | null>(null)
  const open = openForPath === pathname

  const close = () => setOpenForPath(null)
  const toggle = () => setOpenForPath(open ? null : pathname)

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          )}
        </svg>
      </Button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-16 border-b border-slate-200 bg-white shadow-lg"
        >
          <nav
            aria-label="Mobile"
            className="container-page flex flex-col gap-1 py-4"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="hover:text-navy-800 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              {signedIn ? (
                <>
                  {isAdmin && (
                    <ButtonLink href="/admin" variant="secondary" fullWidth>
                      Admin
                    </ButtonLink>
                  )}
                  <ButtonLink href="/dashboard" fullWidth>
                    Go to dashboard
                  </ButtonLink>
                  <SignOutButton fullWidth />
                </>
              ) : (
                <>
                  <ButtonLink href="/login" variant="secondary" fullWidth>
                    Sign in
                  </ButtonLink>
                  <ButtonLink href="/signup" fullWidth>
                    Create account
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
