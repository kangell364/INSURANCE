import Link from 'next/link'

const FOOTER_SECTIONS = [
  {
    heading: 'Platform',
    links: [
      { href: '/courses', label: 'Courses' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create account' },
      { href: '/dashboard', label: 'Student dashboard' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 mt-auto text-slate-300">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="text-base font-semibold text-white">
              Texas Insurance Exam Prep
            </p>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              Structured preparation for Texas insurance licensing
              examinations, beginning with the General Lines Property &amp;
              Casualty exam.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-sm font-semibold text-white">
                {section.heading}
              </p>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} Texas Insurance Exam Prep. All
            rights reserved.
          </p>
          <p className="mt-2 max-w-3xl">
            This platform provides exam preparation material only. It is not
            affiliated with, endorsed by, or a substitute for the Texas
            Department of Insurance or its testing vendor, and it does not
            issue licences.
          </p>
        </div>
      </div>
    </footer>
  )
}
