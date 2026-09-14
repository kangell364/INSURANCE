import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the Texas Insurance Exam Prep team.',
  robots: { index: true, follow: true },
}

const CHANNELS = [
  {
    title: 'Student support',
    detail: 'support@example.com',
    body: 'Account access, billing and technical problems. We aim to reply within one business day.',
  },
  {
    title: 'Course content',
    detail: 'content@example.com',
    body: 'Questions about course material, or a correction you would like us to review.',
  },
  {
    title: 'Group and agency enquiries',
    detail: 'agencies@example.com',
    body: 'Licensing multiple seats for an agency or a training programme.',
  },
]

export default function ContactPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        description="We are a small team and we read everything that comes in."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {CHANNELS.map((channel) => (
          <Card key={channel.title} as="article">
            <CardBody>
              <h2 className="text-base font-semibold">{channel.title}</h2>
              <a
                href={`mailto:${channel.detail}`}
                className="text-navy-700 mt-1 block text-sm font-medium hover:underline"
              >
                {channel.detail}
              </a>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {channel.body}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-10 max-w-3xl">
        {/*
          A contact form would need spam protection, a delivery provider and a
          place to store submissions — none of which are in Phase 1 scope.
          Published addresses are honest about what exists today; a form that
          silently discarded messages would not be.
        */}
        <Alert variant="info" title="Contact form coming in a later release">
          The addresses above are monitored today. An in-app contact form with
          ticket tracking arrives alongside the student support tooling.
        </Alert>
      </div>

      <div className="mt-10 max-w-3xl text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-800">
          Licensing questions
        </h2>
        <p className="mt-2 leading-relaxed">
          We can help you prepare for the examination, but we cannot answer
          questions about your licence application, eligibility or examination
          booking. Those are handled by the Texas Department of Insurance and
          its testing vendor, and you should contact them directly.
        </p>
      </div>
    </div>
  )
}
