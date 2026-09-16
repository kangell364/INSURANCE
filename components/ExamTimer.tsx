'use client'

/**
 * The countdown on a mock.
 *
 * WHAT THIS IS AND IS NOT
 *
 * It is a rehearsal aid. The state exam allows 150 minutes for 130 questions,
 * and a candidate who has never felt that pressure will feel it for the first
 * time in the test centre. So the clock runs, and at zero the paper submits
 * itself — because that is what happens on the day.
 *
 * It is NOT enforcement. The clock is computed from `started_at`, which the
 * server set, but a student who closes the tab and reopens it after three
 * hours will simply find a submitted paper or an expired one; nothing stops
 * them thinking about a question for as long as they like in between.
 *
 * That is a deliberate limit rather than an oversight. Enforcing it
 * server-side would mean refusing to score a paper somebody spent real effort
 * on, which punishes the honest case (a phone call, a child, a lost
 * connection) to deter a dishonest one that only cheats the student
 * themselves. The results screen shows elapsed time instead, so an overrun is
 * visible rather than pretended away.
 */

import { useEffect, useRef, useState } from 'react'

type Props = {
  startedAt: string
  limitMinutes: number
  onExpire: () => void
}

function format(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function ExamTimer({ startedAt, limitMinutes, onExpire }: Props) {
  const deadline = new Date(startedAt).getTime() + limitMinutes * 60_000
  const [remaining, setRemaining] = useState(() =>
    Math.floor((deadline - Date.now()) / 1000),
  )
  // A ref, not state: firing is a one-way latch that must never itself cause
  // a render, and setting state inside the effect below would cascade.
  const fired = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.floor((deadline - Date.now()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [deadline])

  useEffect(() => {
    // Latched so a re-render at exactly zero cannot submit twice.
    if (remaining <= 0 && !fired.current) {
      fired.current = true
      onExpire()
    }
  }, [remaining, onExpire])

  const urgent = remaining <= 300 && remaining > 0

  return (
    <p
      // Announced politely rather than assertively: a screen reader reading
      // out every second would make the paper unusable.
      aria-live="polite"
      className={[
        'font-mono text-sm tabular-nums',
        urgent
          ? 'font-semibold text-rose-700 dark:text-rose-400'
          : 'text-slate-600 dark:text-slate-400',
      ].join(' ')}
    >
      {remaining > 0 ? `${format(remaining)} left` : 'Time is up'}
    </p>
  )
}
