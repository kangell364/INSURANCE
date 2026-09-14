import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ComingSoon, EmptyState } from '@/components/ui/States'

export const metadata: Metadata = { title: 'Practice exams' }

const PLANNED = [
  {
    title: 'Timed practice exams',
    description:
      'Question sets drawn from the tagged bank, timed to the same limit as the state exam.',
  },
  {
    title: 'State-exam simulation',
    description:
      'A full-length paper matching the published blueprint weightings, section by section.',
  },
  {
    title: 'Topic-level scoring',
    description:
      'Results broken down by exam topic so you know exactly where to study next.',
  },
  {
    title: 'Attempt history',
    description:
      'Every attempt retained, so you can see whether your scores are actually trending upward.',
  },
]

export default async function ExamsPage() {
  await requireAuth()

  return (
    <>
      <PageHeader
        title="Practice exams"
        description="Timed practice and full state-exam simulations."
      />

      <div className="mb-6">
        <Alert variant="info" title="Coming in a later release">
          The exam engine is in development. Practice exams will appear here
          automatically for every course you are enrolled in.
        </Alert>
      </div>

      <Card>
        <CardHeader title="Your attempts" />
        <EmptyState
          title="No attempts yet"
          description="Completed practice exams will be listed here with your score, the time taken and a topic breakdown."
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </ButtonLink>
          }
        />
      </Card>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        {PLANNED.map((item) => (
          <ComingSoon
            key={item.title}
            title={item.title}
            description={item.description}
          />
        ))}
      </section>
    </>
  )
}
