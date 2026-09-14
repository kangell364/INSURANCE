/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ==========================================================================
   Data access.

   RLS is what actually restricts rows (proven in supabase/tests). What these
   tests pin down is the layer above it: that queries are shaped correctly,
   that a failure produces a safe message rather than an exception, and that a
   missing configuration is reported as configuration rather than as a crash.
   ========================================================================== */

const configuredMock = vi.hoisted(() => vi.fn(() => true))
const fromMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: configuredMock,
  publicEnv: () => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
    siteUrl: 'http://localhost:3000',
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}))

const { getActiveCourses, getMyEnrollments } = await import('@/lib/queries')

/** Minimal PostgREST-style chainable builder that resolves to `result`. */
function builder(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn((_columns: string) => chain),
    eq: vi.fn((_column: string, _value: unknown) => chain),
    order: vi.fn((_column: string, _options: { ascending: boolean }) =>
      Promise.resolve(result),
    ),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  configuredMock.mockReturnValue(true)
})

describe('getActiveCourses', () => {
  it('requests only active courses, ordered by title', async () => {
    const chain = builder({ data: [{ id: 'c1', title: 'A' }], error: null })
    fromMock.mockReturnValue(chain)

    const result = await getActiveCourses()

    expect(fromMock).toHaveBeenCalledWith('courses')
    expect(chain.eq).toHaveBeenCalledWith('status', 'active')
    expect(chain.order).toHaveBeenCalledWith('title', { ascending: true })
    expect(result.data).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('returns an empty array rather than null when nothing is published', async () => {
    fromMock.mockReturnValue(builder({ data: null, error: null }))

    const result = await getActiveCourses()
    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('converts a database error into a safe message and logs the detail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fromMock.mockReturnValue(
      builder({
        data: null,
        error: {
          code: '42501',
          message: 'permission denied for table courses',
          details: 'internal',
        },
      }),
    )

    const result = await getActiveCourses()

    expect(result.data).toBeNull()
    expect(result.error).toBe(
      'We could not load this information right now. Please try again shortly.',
    )
    expect(result.error).not.toContain('permission denied')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('names the missing configuration instead of throwing', async () => {
    configuredMock.mockReturnValue(false)

    const result = await getActiveCourses()

    expect(result.data).toBeNull()
    expect(result.error).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(result.error).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('never names the service-role key in a user-facing message', async () => {
    configuredMock.mockReturnValue(false)

    const result = await getActiveCourses()
    expect(result.error).not.toContain('SERVICE_ROLE')
  })
})

describe('getMyEnrollments', () => {
  it('filters to the id it is given, which callers take from the session', async () => {
    const chain = builder({ data: [], error: null })
    fromMock.mockReturnValue(chain)

    await getMyEnrollments('student-1')

    expect(fromMock).toHaveBeenCalledWith('enrollments')
    expect(chain.eq).toHaveBeenCalledWith('student_id', 'student-1')
    expect(chain.order).toHaveBeenCalledWith('enrolled_at', {
      ascending: false,
    })
  })

  it('joins the course so the UI does not need a second round trip', async () => {
    const chain = builder({ data: [], error: null })
    fromMock.mockReturnValue(chain)

    await getMyEnrollments('student-1')

    expect(chain.select.mock.calls[0][0]).toContain('course:courses')
  })

  it('converts a database error into a safe message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fromMock.mockReturnValue(
      builder({
        data: null,
        error: { code: 'PGRST301', message: 'JWT expired', details: null },
      }),
    )

    const result = await getMyEnrollments('student-1')

    expect(result.data).toBeNull()
    expect(result.error).not.toContain('JWT')
    consoleError.mockRestore()
  })
})
