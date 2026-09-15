import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getAdminCounts, getContentCounts } from '@/lib/queries'
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
  /** Set when some of this section already works and can be visited. */
  status?: 'partial'
  /** Where the working part of this section lives, when there is one. */
  href?: string
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
      'Choose a course to author. Creating a course itself is still done in SQL; everything inside one is editable here.',
    phase: 'Phase 2',
    status: 'partial',
    href: '/admin/content',
  },
  {
    title: 'Modules',
    description:
      'Organise a course into modules, reorder them, and publish or unpublish each one. Unpublishing a module hides its lessons too.',
    phase: 'Phase 2',
    status: 'partial',
    href: '/admin/content',
  },
  {
    title: 'Lessons',
    description:
      'Write lesson bodies in Markdown with a live preview, set reading time, and tag each lesson with the blueprint topics it teaches.',
    phase: 'Phase 2',
    status: 'partial',
    href: '/admin/content',
  },
  {
    title: 'Exam blueprint',
    description:
      'Maintain the topic taxonomy and its published weightings, which drive per-topic scoring and the readiness calculation.',
    phase: 'Phase 2',
    status: 'partial',
    href: '/admin/content',
  },
  {
    title: 'Question bank',
    description:
      'Manage tagged exam questions and their protected answer keys, which never leave the server.',
    phase: 'Phase 3',
  },
  {
    // Distinct from 'Exam blueprint' above: that one is the topic TAXONOMY
    // (what the state tests). This one is the paper RECIPE (how many questions
    // we draw from each topic to build a practice exam).
    title: 'Practice exam papers',
    description:
      'Define how many questions each topic contributes to a generated practice exam, matching the published blueprint weightings.',
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

  const [{ data: counts, error }, { data: content }] = await Promise.all([
    getAdminCounts(),
    getContentCounts(),
  ])
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

      {content && (
        <Card className="mt-6">
          <CardBody>
            <dl className="grid gap-6 sm:grid-cols-3">
              <Stat
                label="Modules"
                value={String(content.modules)}
                hint="Drafts included"
              />
              <Stat
                label="Lessons"
                value={String(content.lessons)}
                hint="Drafts included"
              />
              <Stat
                label="Blueprint topics"
                value={String(content.topics)}
              />
            </dl>
          </CardBody>
        </Card>
      )}

      <div className="mt-6">
        <Alert variant="info" title="Start here">
          <Link
            href="/admin/content"
            className="font-medium text-navy-800 underline underline-offset-2"
          >
            Course content
          </Link>{' '}
          is where modules, lessons and the exam blueprint are edited. Creating
          a course itself still needs SQL; everything inside one does not.
        </Alert>
      </div>

      <h2 id="management-tools" className="mt-8 text-lg">
        Management tools
      </h2>
      {/* Named via aria-labelledby so assistive technology announces what the
          list is, and so tests can scope queries to it rather than to the whole
          page. */}
      <ul
        aria-labelledby="management-tools"
        className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SECTIONS.map((section) => (
          <Card key={section.title} as="li">
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold">
                  {section.href ? (
                    <Link
                      href={section.href}
                      className="text-navy-800 hover:underline"
                    >
                      {section.title}
                    </Link>
                  ) : (
                    section.title
                  )}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    section.status === 'partial'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {section.status === 'partial' ? 'In progress' : section.phase}
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
