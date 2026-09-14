'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = {
  href: string
  label: string
  /** Rendered muted, with a "Soon" tag, for Phase 2+ destinations. */
  upcoming?: boolean
}

/**
 * Sidebar navigation shared by the student dashboard and the admin shell.
 *
 * A Client Component only because it highlights the active route from
 * `usePathname()`. It renders no privileged information: which links appear is
 * decided on the server by the layout that passes `items` in.
 */
export function DashboardNav({
  items,
  label,
}: {
  items: NavItem[]
  label: string
}) {
  const pathname = usePathname()

  return (
    <nav aria-label={label} className="lg:sticky lg:top-24">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' &&
              item.href !== '/admin' &&
              pathname.startsWith(`${item.href}/`))

          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-navy-800 text-white'
                    : 'hover:text-navy-800 text-slate-600 hover:bg-white'
                }`}
              >
                <span>{item.label}</span>
                {item.upcoming && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Soon
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
