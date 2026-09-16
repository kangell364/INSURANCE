import 'server-only'

/**
 * Attempts: starting a paper, reading it back, and scoring it.
 *
 * WHAT THIS FILE DELIBERATELY CANNOT DO
 *
 * It cannot build a paper, and it cannot mark one. Both happen in the
 * database, in `start_attempt()` and `score_attempt()`, because both need to
 * touch things the caller may not: a student holds no `insert` on `attempts`
 * or `attempt_questions`, and nobody at all may read `question_answers`.
 *
 * That is not a style choice. If paper assembly lived here, a student could
 * call the same endpoint with their own list of easy question ids and move
 * their own readiness figure, which is computed from mock attempts.
 *
 * So every function below is a thin, honest wrapper. Where one looks like it
 * is doing something clever, it is not — the cleverness is in the migration.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import type { QueryResult } from '@/lib/queries'
import type { AttemptKind, RevealMode } from '@/types'

const GENERIC_ERROR =
  'We could not load this exam right now. Please try again shortly.'

const NOT_CONFIGURED =
  'The application is not connected to its database yet.'

function logFailure(scope: string, error: PostgrestError): void {
  console.error(`[attempts:${scope}] failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
  })
}

/** A question as a student may see it: stem, options, and no key. */
export type PaperQuestion = {
  questionId: string
  position: number
  stem: string
  /** Present only once the reveal is allowed; null while sitting the paper. */
  explanation: string | null
  options: { id: string; body: string; position: number }[]
  selectedOptionId: string | null
  /** Null until score_attempt() writes it. Never inferred here. */
  isCorrect: boolean | null
}

export type Paper = {
  attemptId: string
  courseId: string
  kind: AttemptKind
  reveal: RevealMode
  startedAt: string
  submittedAt: string | null
  correctCount: number | null
  questionCount: number
  questions: PaperQuestion[]
}

/**
 * Ask the database to assemble a paper.
 *
 * Returns the new attempt's id. The three scope arguments are mutually
 * exclusive by kind and the database enforces that with check constraints, so
 * passing the wrong one produces an error rather than a quietly wrong paper.
 */
export async function startAttempt(input: {
  courseId: string
  kind: AttemptKind
  lessonId?: string
  moduleId?: string
  topicId?: string
  reveal?: RevealMode
}): Promise<QueryResult<string>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_attempt', {
    p_course_id: input.courseId,
    p_kind: input.kind,
    p_lesson_id: input.lessonId ?? null,
    p_module_id: input.moduleId ?? null,
    p_topic_id: input.topicId ?? null,
    p_reveal: input.reveal ?? null,
  })

  if (error) {
    logFailure('start', error)
    // no_data_found is the one case worth explaining rather than swallowing:
    // it means nothing in scope has been reviewed yet, which is a content
    // state rather than a fault, and the student can act on knowing it.
    if (error.code === 'P0002' || /no published questions/i.test(error.message)) {
      return {
        data: null,
        error:
          'There are no published questions for this selection yet. ' +
          'Questions appear once a licensed producer has reviewed them.',
      }
    }
    return { data: null, error: GENERIC_ERROR }
  }

  return { data: data as string, error: null }
}

/**
 * Read a paper back.
 *
 * RLS returns only the caller's own attempt, so an attempt id belonging to
 * somebody else comes back empty rather than forbidden — which is also why
 * this returns null for "not found" and "not yours" alike.
 *
 * The explanation is withheld while the paper is still being sat, and only
 * for an `on_submit` attempt. Sending it to the browser and hiding it in CSS
 * would put the teaching — and a strong hint at the answer — one devtools
 * panel away.
 */
export async function getPaper(attemptId: string): Promise<QueryResult<Paper | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()

  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select(
      'id, course_id, kind, reveal, started_at, submitted_at, correct_count, question_count',
    )
    .eq('id', attemptId)
    .maybeSingle()

  if (attemptError) {
    logFailure('paper.attempt', attemptError)
    return { data: null, error: GENERIC_ERROR }
  }
  if (!attempt) return { data: null, error: null }

  const revealed = attempt.submitted_at !== null || attempt.reveal === 'immediate'

  const { data: rows, error: rowsError } = await supabase
    .from('attempt_questions')
    .select(
      `position, selected_option_id, is_correct,
       question:questions (
         id, stem, explanation,
         options:question_options ( id, body, position )
       )`,
    )
    .eq('attempt_id', attemptId)
    .order('position', { ascending: true })

  if (rowsError) {
    logFailure('paper.questions', rowsError)
    return { data: null, error: GENERIC_ERROR }
  }

  type Row = {
    position: number
    selected_option_id: string | null
    is_correct: boolean | null
    question: {
      id: string
      stem: string
      explanation: string | null
      options: { id: string; body: string; position: number }[]
    } | null
  }

  const questions: PaperQuestion[] = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.question !== null)
    .map((r) => ({
      questionId: r.question!.id,
      position: r.position,
      stem: r.question!.stem,
      explanation: revealed ? r.question!.explanation : null,
      options: [...r.question!.options].sort((a, b) => a.position - b.position),
      selectedOptionId: r.selected_option_id,
      isCorrect: r.is_correct,
    }))

  return {
    data: {
      attemptId: attempt.id,
      courseId: attempt.course_id,
      kind: attempt.kind,
      reveal: attempt.reveal,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      correctCount: attempt.correct_count,
      questionCount: attempt.question_count,
      questions,
    },
    error: null,
  }
}

/**
 * Record an answer.
 *
 * This is an UPDATE, which is the one write a student still holds on
 * attempt_questions, and `attempt_questions_update_own_unsubmitted` confines
 * it to their own unsubmitted attempt. A late answer therefore matches zero
 * rows rather than being rejected, which is the correct outcome: the paper is
 * already scored and the click changes nothing.
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  optionId: string,
): Promise<QueryResult<true>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { error } = await supabase
    .from('attempt_questions')
    .update({ selected_option_id: optionId, answered_at: new Date().toISOString() })
    .eq('attempt_id', attemptId)
    .eq('question_id', questionId)

  if (error) {
    logFailure('answer', error)
    return { data: null, error: 'We could not save that answer. Please try again.' }
  }
  return { data: true, error: null }
}

/** Submit and score. The counts come back; the key never does. */
export async function submitAttempt(
  attemptId: string,
): Promise<QueryResult<{ correctCount: number; questionCount: number }>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('score_attempt', { p_attempt_id: attemptId })

  if (error) {
    logFailure('submit', error)
    return {
      data: null,
      error: 'We could not submit this exam. It may already have been submitted.',
    }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { data: null, error: GENERIC_ERROR }

  return {
    data: { correctCount: row.correct_count, questionCount: row.question_count },
    error: null,
  }
}

/** One row of a student's attempt history. */
export type AttemptSummary = {
  id: string
  kind: AttemptKind
  startedAt: string
  submittedAt: string | null
  correctCount: number | null
  questionCount: number
  /** Null while the attempt is unfinished; there is no score to show yet. */
  scorePercent: number | null
}

/**
 * The caller's own attempts, newest first.
 *
 * RLS confines this to their rows, so there is no student_id filter here to
 * forget. Unfinished attempts are included deliberately: a student who closed
 * the tab mid-paper needs to find their way back to it.
 */
export async function getMyAttempts(
  courseId: string,
  limit = 20,
): Promise<QueryResult<AttemptSummary[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attempts')
    .select('id, kind, started_at, submitted_at, correct_count, question_count')
    .eq('course_id', courseId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    logFailure('history', error)
    return { data: null, error: GENERIC_ERROR }
  }

  return {
    data: (data ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      startedAt: a.started_at,
      submittedAt: a.submitted_at,
      correctCount: a.correct_count,
      questionCount: a.question_count,
      scorePercent:
        a.submitted_at !== null && a.correct_count !== null && a.question_count > 0
          ? Math.round((a.correct_count / a.question_count) * 100)
          : null,
    })),
    error: null,
  }
}

/**
 * Readiness from recent MOCK attempts only.
 *
 * Mocks alone, because only a mock is blueprint-weighted — averaging a lesson
 * quiz on the one topic a student has just revised would flatter them. Recent
 * rather than lifetime, per the retake decision: a candidate who has improved
 * should not be held down by their first attempt.
 *
 * Returns null when there are no scored mocks, which the caller must render as
 * "not measured yet" rather than as zero. A student who has not sat a mock is
 * not unready; they are unmeasured, and the difference matters.
 */
export async function getReadiness(
  courseId: string,
  sample = 3,
): Promise<QueryResult<{ scorePercent: number; fromAttempts: number } | null>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attempts')
    .select('correct_count, question_count')
    .eq('course_id', courseId)
    .eq('kind', 'mock')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(sample)

  if (error) {
    logFailure('readiness', error)
    return { data: null, error: GENERIC_ERROR }
  }

  const scored = (data ?? []).filter(
    (a) => a.correct_count !== null && a.question_count > 0,
  )
  if (scored.length === 0) return { data: null, error: null }

  const correct = scored.reduce((sum, a) => sum + (a.correct_count ?? 0), 0)
  const asked = scored.reduce((sum, a) => sum + a.question_count, 0)

  return {
    data: {
      scorePercent: Math.round((correct / asked) * 100),
      fromAttempts: scored.length,
    },
    error: null,
  }
}

/** How a submitted paper went, topic by topic. */
export type TopicResult = {
  topicId: string
  code: string
  name: string
  correct: number
  asked: number
  scorePercent: number
}

/**
 * The per-topic breakdown of a submitted paper.
 *
 * `score_attempt()` returns totals only — it is deliberately narrow, because
 * its job is to compare against a table nobody may read. This is the ordinary
 * query that follows: by the time it runs, `is_correct` has already been
 * written, and a student reading their own marks back discloses nothing.
 *
 * Sorted weakest first. A results screen exists to say what to do next, and
 * the topic a student did worst on is the answer.
 */
export async function getTopicBreakdown(
  attemptId: string,
): Promise<QueryResult<TopicResult[]>> {
  if (!isSupabaseConfigured()) return { data: null, error: NOT_CONFIGURED }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attempt_questions')
    .select('is_correct, question:questions ( topic:topics ( id, code, name ) )')
    .eq('attempt_id', attemptId)

  if (error) {
    logFailure('breakdown', error)
    return { data: null, error: GENERIC_ERROR }
  }

  type Row = {
    is_correct: boolean | null
    question: { topic: { id: string; code: string; name: string } | null } | null
  }

  const byTopic = new Map<string, TopicResult>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const topic = row.question?.topic
    if (!topic) continue

    const entry = byTopic.get(topic.id) ?? {
      topicId: topic.id,
      code: topic.code,
      name: topic.name,
      correct: 0,
      asked: 0,
      scorePercent: 0,
    }
    entry.asked += 1
    if (row.is_correct === true) entry.correct += 1
    byTopic.set(topic.id, entry)
  }

  const results = [...byTopic.values()].map((t) => ({
    ...t,
    scorePercent: t.asked > 0 ? Math.round((t.correct / t.asked) * 100) : 0,
  }))

  // Weakest first, then by blueprint code so equal scores keep a stable order
  // rather than shuffling between renders.
  results.sort((a, b) => a.scorePercent - b.scorePercent || a.code.localeCompare(b.code))

  return { data: results, error: null }
}
