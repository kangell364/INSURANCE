import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  eyebrow?: string
  action?: ReactNode
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-navy-500 text-xs font-semibold tracking-widest uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
