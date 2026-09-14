import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { getAdminCounts } from '@/lib/queries'
import { fullName } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Stat } from '@/components/ui/Progress'

export const metadata: Metadata = { title: 'Admin' }

type AdminSection = {
  title: string
  description: string
  phase: string
}

/**
 * Placeholders for the tools each later phase delivers.
 *
 * Every one is explicitly labelled with the phase it belongs to. None of them
 * link anywhere: a card that navigates to a dead route reads as a bug, while a
 * card that says "Phase 2" reads as a plan.
 */
const SECTIONS: AdminSection[] = [
  {
    title: 'Courses',
    description:
      'Create and publish courses, manage the draft / active / archived lifecycle.',
    phase: 'Phase 2',
  },
  {
    title: 'Modules',
    description:
      'Organise each course into modules and control their order within the course.',
    phase: 'Phase 2',
  },
  {
    title: 'Lessons',
    description:
      'Author lesson content, attach media and set the lesson-level quiz.',
    phase: 'Phase 2',
  },
  {
    title: 'Question bank',
    description:
      'Manage tagged exam questions and their protected answer keys, which never leave the server.',
    phase: 'Phase 3',
  },
  {
    title: 'Exam blueprints',
    description:
      'Define how many questions each topic contributes to a practice exam, matching the state blueprint.',
    phase: 'Phase 3',
  },
  {
    title: 'Students',
    description:
      'Search student accounts, review enrollments and grant or revoke course access.',
    phase: 'Phase 4',
  },
  {
    title: 'Instructors',
    description:
      'Assign instructor accounts to courses and manage what each one can see.',
    phase: 'Phase 4',
  },
  {
    title: 'Reports',
    description:
      'Cohort performance, pass-rate tracking and per-topic difficulty analysis.',
    phase: 'Phase 5',
  },
  {
    title: 'Settings',
    description:
      'Platform configuration, branding and — once payments land — subscription plans.',
    phase: 'Phase 5',
  },
]

export default async function AdminPage() {
  // The layout already gated this route; calling it again here means the page
  // is safe on its own terms and never relies on a parent for authorization.
  const context = await requireAdmin()
  if (!context) return null

  const { data: counts, error } = await getAdminCounts()
  const name = fullName(context.profile)

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Admin dashboard"
        description={
          name
            ? `Signed in as ${name}. Platform management tools.`
            : 'Platform management tools.'
        }
      />

      {error && (
        <div className="mb-6">
          <Alert variant="warning" title="Statistics unavailable">
            {error}
          </Alert>
        </div>
      )}

      {counts && (
        <Card>
          <CardBody>
            <dl className="grid gap-6 sm:grid-cols-3">
              <Stat label="Student accounts" value={String(counts.students)} />
              <Stat label="Courses" value={String(counts.courses)} />
              <Stat label="Enrollments" value={String(counts.enrollments)} />
            </dl>
          </CardBody>
        </Card>
      )}

      <div className="mt-6">
        <Alert variant="info" title="Phase 1 admin shell">
          This is the navigation shell only. The tools below are stubs — they
          are listed so the structure is agreed before the systems behind them
          are built.
        </Alert>
      </div>

      <h2 className="mt-8 text-lg">Management tools</h2>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Card key={section.title} as="li">
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold">{section.title}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-600">
                  {section.phase}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {section.description}
              </p>
            </CardBody>
          </Card>
        ))}
      </ul>
    </>
  )
}
