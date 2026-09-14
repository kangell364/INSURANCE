type ProgressBarProps = {
  /** Completion from 0 to 100. */
  value: number
  label: string
  /**
   * When false the bar renders in a muted "no data yet" style. Phase 1 has no
   * scoring engine, so most progress displays are genuinely indeterminate and
   * must not imply a real measurement.
   */
  hasData?: boolean
}

export function ProgressBar({
  value,
  label,
  hasData = true,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-500 tabular-nums">
          {hasData ? `${clamped}%` : 'Not started'}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuenow={hasData ? clamped : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={hasData ? `${clamped}%` : 'Not started'}
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            hasData ? 'bg-navy-600' : 'bg-slate-300'
          }`}
          style={{ width: `${hasData ? clamped : 0}%` }}
        />
      </div>
    </div>
  )
}

type StatProps = {
  label: string
  value: string
  hint?: string
}

export function Stat({ label, value, hint }: StatProps) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-navy-900 mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </dd>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
