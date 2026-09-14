import Link from 'next/link'

export function Logo({
  href = '/',
  tone = 'dark',
}: {
  href?: string
  tone?: 'dark' | 'light'
}) {
  const text = tone === 'dark' ? 'text-navy-900' : 'text-white'
  const sub = tone === 'dark' ? 'text-slate-500' : 'text-navy-200'

  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span
        className="bg-navy-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
        aria-hidden="true"
      >
        TX
      </span>
      <span className="leading-tight">
        <span className={`block text-sm font-semibold ${text}`}>
          Texas Insurance Exam Prep
        </span>
        <span className={`block text-xs ${sub}`}>
          Licensing preparation for Texas producers
        </span>
      </span>
    </Link>
  )
}
