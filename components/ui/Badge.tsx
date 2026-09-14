import type { EnrollmentStatus } from '@/types'
import { enrollmentStatusLabel } from '@/types'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-navy-100 text-navy-800',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const ENROLLMENT_TONES: Record<EnrollmentStatus, BadgeTone> = {
  active: 'success',
  completed: 'info',
  expired: 'warning',
  cancelled: 'neutral',
}

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <Badge tone={ENROLLMENT_TONES[status]}>
      {enrollmentStatusLabel(status)}
    </Badge>
  )
}
