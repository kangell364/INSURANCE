import type { Metadata } from 'next'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s · Texas Insurance Exam Prep" template
  // does not append the brand name to a title that already carries it.
  title: {
    absolute: 'Texas Insurance Exam Prep — Pass the Texas licensing exam',
  },
  description:
    'Exam preparation for the Texas General Lines Property & Casualty ' +
    'licence: structured study, topic-level practice and full exam ' +
    'simulations.',
  robots: { index: true, follow: true },
}

const VALUE_PROPS = [
  {
    title: 'Built to the state exam blueprint',
    body:
      'Every topic is mapped to the sections the Texas General Lines ' +
      'Property & Casualty examination actually tests, so study time goes ' +
      'where the marks are.',
  },
  {
    title: 'Practice under real conditions',
    body:
      'Timed practice exams that mirror the length, pacing and question ' +
      'style of the state exam — the part most candidates are least ' +
      'prepared for.',
  },
  {
    title: 'Know when you are ready',
    body:
      'Topic-level scoring shows exactly which areas are holding your score ' +
      'down, instead of a single percentage that tells you nothing ' +
      'actionable.',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Register in under a minute. No credit card required to get started.',
  },
  {
    step: '02',
    title: 'Work through the course',
    body: 'Modules, lessons and quizzes ordered the way the exam is ordered.',
  },
  {
    step: '03',
    title: 'Simulate the exam',
    body: 'Full-length timed simulations until your scores are consistently clear of the pass mark.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 text-white">
        <div className="container-page py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="text-accent-300 text-xs font-semibold tracking-widest uppercase">
              Texas General Lines · Property &amp; Casualty
            </p>
            <h1 className="mt-4 text-4xl text-white sm:text-5xl">
              Pass your Texas insurance licensing exam the first time.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              A focused preparation platform for candidates sitting the Texas
              General Lines Property &amp; Casualty examination — structured
              coursework, targeted practice and full exam simulations in one
              place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/signup"
                size="lg"
                className="bg-accent-500 hover:bg-accent-600 text-white"
              >
                Create your account
              </ButtonLink>
              <ButtonLink
                href="/courses"
                size="lg"
                variant="secondary"
                className="border-white/25 bg-transparent text-white hover:border-white/40 hover:bg-white/10"
              >
                Browse courses
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Value propositions */}
      <section className="container-page py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl">
          Preparation built for working adults
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Most candidates studying for a Texas licence are doing it around a
          job. The platform is designed for short, high-value study sessions
          rather than open-ended reading.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((item) => (
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
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((item) => (
              <li key={item.step}>
                <span className="bg-navy-50 text-navy-700 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="container-page py-16 sm:py-20">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-6 py-8">
            <div className="max-w-xl">
              <h2 className="text-xl">Ready to start studying?</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create a free student account and get access to the course
                catalogue.
              </p>
            </div>
            <ButtonLink href="/signup" size="lg">
              Create your account
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </>
  )
}
