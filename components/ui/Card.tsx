import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}

export function Card({ children, className = '', as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={`rounded-(--radius-card) border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </Tag>
  )
}

type CardHeaderProps = {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Heading level, so card headings nest correctly under the page heading. */
  level?: 2 | 3
}

export function CardHeader({
  title,
  description,
  action,
  level = 2,
}: CardHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <Heading className="text-base font-semibold">{title}</Heading>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`px-5 py-5 sm:px-6 ${className}`}>{children}</div>
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-b-(--radius-card) border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
      {children}
    </div>
  )
}
