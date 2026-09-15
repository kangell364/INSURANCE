import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  BLUEPRINT,
  EXAM,
  EXAM_FACTS_SOURCES,
  EXCUSED_ABSENCE_REASONS,
  PASS_RATES,
  PRIMARY_ID,
  SECONDARY_ID,
} from '@/lib/exam-facts'

/**
 * "What to expect on exam day".
 *
 * Written entirely from lib/exam-facts.ts, which is transcribed from Pearson
 * VUE #124400 and #124401. Nothing on this page is recalled or inferred, and
 * the sources are named at the foot of it so a reader can check.
 *
 * That matters more here than on a marketing page usually would. Someone
 * reading this is about to spend $49 and take an afternoon off, and the two
 * facts most likely to cost them both — needing TWO forms of ID, and the
 * 48-hour cancellation window — are exactly the ones a vague page omits.
 */
export const metadata: Metadata = {
  title: 'Texas insurance exam day: what to expect',
  description:
    'What actually happens on the day of the Texas General Lines Property & Casualty licensing exam: 150 minutes, 145 questions, $49, two forms of ID, and the rules that catch people out.',
  alternates: { canonical: '/texas-exam-day' },
  robots: { index: true, follow: true },
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export default function ExamDayPage() {
  const totalBlueprint = BLUEPRINT.reduce((n, s) => n + s.questions, 0)

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        eyebrow="Before you book"
        title="Texas insurance exam day: what to expect"
        description="The Texas General Lines Property & Casualty examination, as the official candidate handbook describes it — including the two rules that most often cost people their fee."
      />

      <Card>
        <CardBody>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Time allowed" value={`${EXAM.minutes} minutes`} />
            <Fact label="Questions" value={`${EXAM.totalQuestions}`} />
            <Fact label="Examination fee" value={`$${EXAM.feeUsd}`} />
            <Fact label="Arrive" value={`${EXAM.arriveMinutesEarly} min early`} />
          </dl>
        </CardBody>
      </Card>

      <div className="mt-8 max-w-2xl space-y-4 leading-relaxed text-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          The two things that catch people out
        </h2>
        <p>
          Both of these end the same way: you are turned away, marked absent,
          and you lose the ${EXAM.feeUsd}.
        </p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold">
              You need <em>two</em> forms of ID
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Not one. Both must be current and carry your signature, and the
              name on them has to match your exam registration{' '}
              <strong>exactly</strong> — if you registered as
              &ldquo;Robert&rdquo; and your licence says
              &ldquo;Bob&rdquo;, that is a problem. Identification must be in
              English.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Primary — photo &amp; signature
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                  {PRIMARY_ID.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Secondary — signature
                </p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                  {SECONDARY_ID.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              An expired document does not count, and neither does one whose
              signature is embedded in a chip and cannot be seen.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-base font-semibold">
              Cancelling needs {EXAM.cancelNoticeHours} hours&rsquo; notice
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Change or cancel at least {EXAM.cancelNoticeHours} hours before
              your appointment and you can move the fee to a new booking or ask
              for a refund. Less notice than that — or simply not turning up —
              and the fee is gone. You are liable for it personally once the
              booking is made, even if somebody else paid.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Absences the handbook will consider excusing, with documentation:
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
              {EXCUSED_ABSENCE_REASONS.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              Severe weather is handled separately: if the centre is unsafe or
              unreachable, Pearson VUE contacts you and rebooks.
            </p>
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-slate-900 sm:text-2xl">
        What is on the paper
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-slate-700">
        {EXAM.totalQuestions} multiple-choice questions, of which{' '}
        {EXAM.scoredQuestions} are scored and {EXAM.pretestQuestions} are
        unscored pretest questions being trialled for future papers. You cannot
        tell which is which, so answer everything as though it counts.
      </p>
      <p className="mt-3 max-w-2xl leading-relaxed text-slate-700">
        The paper has two parts — {EXAM.generalKnowledgeQuestions} questions of
        general insurance knowledge and {EXAM.stateSpecificQuestions} on Texas
        statutes and rules — but your score is calculated{' '}
        <strong>over the whole exam</strong>, not on each part separately. You
        cannot fail on the Texas section alone.
      </p>

      <Card className="mt-5">
        <CardBody>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Scored questions by blueprint section
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th scope="col" className="pb-2 font-semibold">
                  Section
                </th>
                <th scope="col" className="pb-2 text-right font-semibold">
                  Scored questions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BLUEPRINT.map((section) => (
                <tr key={section.code}>
                  <td className="py-2 text-slate-700">
                    <span className="font-mono text-xs text-slate-400">
                      {section.code}
                    </span>{' '}
                    {section.name}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-700">
                    {section.questions}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold">
                <td className="pt-2">Total scored</td>
                <td className="pt-2 text-right tabular-nums">
                  {totalBlueprint}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      <h2 className="mt-12 text-xl font-semibold text-slate-900 sm:text-2xl">
        How it is scored
      </h2>
      <div className="mt-2 max-w-2xl space-y-3 leading-relaxed text-slate-700">
        <p>
          Texas does not publish a pass percentage, and you should be
          suspicious of anyone who quotes you one. The Department of Insurance
          sets the passing standard, and your result is reported as a{' '}
          <strong>scaled score</strong> rather than a raw mark.
        </p>
        <p>
          The reason is that there are several versions of the paper and they
          differ slightly in difficulty. A statistical correction called
          equating adjusts for that, so the same scaled score means the same
          level of knowledge whichever version you sat. It also means &ldquo;I
          need 70%&rdquo; is not really a sentence about this exam.
        </p>
      </div>

      <Alert variant="info" title="What the pass rates actually look like">
        In August 2026, {PASS_RATES.firstTime.graded.toLocaleString()} people
        sat this exam for the first time and{' '}
        {PASS_RATES.firstTime.ratePercent}% passed. In the same month,{' '}
        {PASS_RATES.repeat.graded.toLocaleString()} people re-sat it after a
        previous failure — and only {PASS_RATES.repeat.ratePercent}% of them
        passed. Second attempts go <em>worse</em>, not better, which is worth
        knowing before you decide to just book again and hope.
      </Alert>

      <h2 className="mt-12 text-xl font-semibold text-slate-900 sm:text-2xl">
        In the room
      </h2>
      <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed text-slate-700">
        <li>
          Arrive {EXAM.arriveMinutesEarly} minutes early to complete
          registration.
        </li>
        <li>
          No personal items at all: phones, watches, wallets, bags, hats. They
          go in a locker or back to your car.
        </li>
        <li>
          Calculators are allowed only if they are silent, hand-held,
          non-printing and have no alphabetic keypad. Financial calculators are
          not permitted, none are provided, and a calculator that fails is not
          grounds for extra time.
        </li>
        <li>There is a tutorial on the machine before the exam begins.</li>
      </ul>

      <h2 className="mt-12 text-xl font-semibold text-slate-900 sm:text-2xl">
        After you pass
      </h2>
      <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed text-slate-700">
        <li>
          Apply for the licence at{' '}
          <a
            href="https://www.sircon.com/texas"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-navy-700 underline underline-offset-2"
          >
            sircon.com/texas
          </a>
          . The application fee is ${EXAM.licenceApplicationFeeUsd} per licence
          type.
        </li>
        <li>
          You have <strong>{EXAM.applyWithinMonths} months</strong> from passing
          to complete the application. Miss that and you sit the exam again.
        </li>
        <li>
          You must be at least 18, and submit the application with its fee and
          your fingerprint receipt.
        </li>
        <li>
          A temporary General Lines licence lasts{' '}
          {EXAM.temporaryLicenceDays} days and cannot be renewed.
        </li>
      </ul>

      <Card className="mt-12">
        <CardBody>
          <h2 className="text-lg font-semibold">
            Preparing so the second attempt never happens
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            The pass rates above are the argument for studying against the
            blueprint rather than against a pile of practice questions. Our
            courses follow the sections in that table, so you can tell which
            ones you are weak on before the day rather than after it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="/courses">Browse the courses</ButtonLink>
            <Link
              href="/signup"
              className="inline-flex items-center px-1 py-2 text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900"
            >
              Create an account
            </Link>
          </div>
        </CardBody>
      </Card>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p className="font-medium text-slate-600">Sources</p>
        <ul className="mt-2 space-y-1">
          <li>{EXAM_FACTS_SOURCES.candidateHandbook}</li>
          <li>{EXAM_FACTS_SOURCES.contentOutline}</li>
          <li>{EXAM_FACTS_SOURCES.passRates}</li>
        </ul>
        <p className="mt-3 max-w-2xl">
          Every figure on this page is taken from those publications. Pearson
          VUE and the Texas Department of Insurance update them; check the
          current candidate handbook before you book, and tell us if anything
          here has gone stale.
        </p>
      </footer>
    </div>
  )
}
