import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Who we build for and how the Texas Insurance Exam Prep platform is put ' +
    'together.',
  robots: { index: true, follow: true },
}

const PRINCIPLES = [
  {
    title: 'Aligned to the published blueprint',
    body: 'Content is organised around the sections and weightings the Texas Department of Insurance publishes for each examination, so study effort tracks what is actually tested.',
  },
  {
    title: 'Honest measurement',
    body: 'Readiness is reported per topic from real practice results. We would rather tell a candidate they are not ready yet than show an encouraging number that costs them an exam fee.',
  },
  {
    title: 'Respect for your time',
    body: 'Candidates are working adults. Lessons are sized for a lunch break, and the platform always shows the single most useful next step.',
  },
  {
    title: 'Exam integrity',
    body: 'Practice results are only meaningful if the questions stay secure. Answer keys and scoring live on the server and are never exposed to the browser.',
  },
]

export default function AboutPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="About"
        title="Built for candidates sitting the Texas exam"
        description="Texas Insurance Exam Prep is a focused preparation platform for people pursuing a Texas insurance producer licence, starting with the General Lines Property & Casualty examination."
      />

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-4 text-slate-600 lg:col-span-2">
          <p className="leading-relaxed">
            Most candidates fail the Texas General Lines Property &amp;
            Casualty exam for one of two reasons: they studied broadly instead
            of to the blueprint, or they had never worked through a full-length
            timed paper before exam day. This platform is organised around
            fixing both.
          </p>
          <p className="leading-relaxed">
            Coursework is broken into modules and lessons that follow the
            structure of the exam itself. Each lesson ends in a short quiz, and
            every question is tagged to a topic, so practice results roll up
            into a readiness picture rather than a single score.
          </p>
          <p className="leading-relaxed">
            The platform is being built in phases. This release is the
            foundation: accounts, secure authentication, the course catalogue
            and the student dashboard. Course content, the question bank and
            the exam simulator follow in subsequent phases.
          </p>
        </div>

        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Current release</h2>
            <p className="mt-2 text-sm text-slate-600">
              Phase 1 — application foundation. Student accounts and the course
              catalogue are live. Lessons, quizzes and exam simulations are in
              development.
            </p>
            <div className="mt-5">
              <ButtonLink href="/signup" fullWidth>
                Create an account
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-16 text-2xl">How we build</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {PRINCIPLES.map((item) => (
          <Card key={item.title} as="article">
            <CardBody>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
