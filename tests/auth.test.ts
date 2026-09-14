import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ==========================================================================
   Server-side route protection.

   These tests exercise the functions that every protected page calls. They do
   not need a database: the point is to prove the decision logic — what happens
   when there is no user, when the profile says `student`, when it says
   `admin`, and when the profile cannot be read at all.
   ========================================================================== */

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    // next/navigation's redirect() throws to unwind rendering. Mirror that so
    // callers cannot accidentally continue past a redirect in a test.
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
)

const getUserMock = vi.hoisted(() => vi.fn())
const maybeSingleMock = vi.hoisted(() => vi.fn())

const pathnameHeader = vi.hoisted(() => ({ current: null as string | null }))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))

// Supabase is "configured" for these tests; the unconfigured path is covered
// in tests/env.test.ts and tests/queries.test.ts.
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => true,
  publicEnv: () => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
    siteUrl: 'http://localhost:3000',
  }),
}))

// The proxy normally sets this header; here it is controlled per test.
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) =>
      name === 'x-tep-pathname' ? pathnameHeader.current : null,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  })),
}))

const { getAuthContext, getUser, requireAdmin, requireAuth } = await import(
  '@/lib/auth'
)

const USER = { id: 'user-1', email: 'ada@example.com' }

function signedIn() {
  getUserMock.mockResolvedValue({ data: { user: USER }, error: null })
}

function signedOut() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: null })
}

function profileRole(role: 'student' | 'instructor' | 'admin') {
  maybeSingleMock.mockResolvedValue({
    data: {
      id: USER.id,
      first_name: 'Ada',
      last_name: 'Alpha',
      email: USER.email,
      role,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  pathnameHeader.current = null
  redirectMock.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  })
})

describe('getUser', () => {
  it('returns the verified user', async () => {
    signedIn()
    await expect(getUser()).resolves.toEqual(USER)
  })

  it('returns null when there is no session', async () => {
    signedOut()
    await expect(getUser()).resolves.toBeNull()
  })

  it('uses getUser(), which revalidates the token, not getSession()', async () => {
    signedIn()
    await getUser()
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })
})

describe('getAuthContext', () => {
  it('returns null for an anonymous request', async () => {
    signedOut()
    await expect(getAuthContext()).resolves.toBeNull()
  })

  it('returns the user and their profile', async () => {
    signedIn()
    profileRole('student')

    const context = await getAuthContext()
    expect(context?.user).toEqual(USER)
    expect(context?.profile?.role).toBe('student')
    expect(context?.profileError).toBeNull()
  })

  it('degrades gracefully — and without leaking the driver error — when the profile read fails', async () => {
    signedIn()
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: {
        code: '42P01',
        message: 'relation "public.profiles" does not exist',
        details: 'internal detail',
      },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const context = await getAuthContext()

    expect(context?.user).toEqual(USER)
    expect(context?.profile).toBeNull()
    expect(context?.profileError).toBeTruthy()
    expect(context?.profileError).not.toContain('relation')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('reports a missing profile row distinctly from a failed query', async () => {
    signedIn()
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    const context = await getAuthContext()
    expect(context?.profile).toBeNull()
    expect(context?.profileError).toMatch(/missing/i)
  })
})

describe('requireAuth', () => {
  it('redirects an anonymous visitor to /login', async () => {
    signedOut()
    pathnameHeader.current = '/dashboard'
    await expect(requireAuth()).rejects.toThrow(
      'NEXT_REDIRECT:/login?next=%2Fdashboard',
    )
  })

  it('drops an off-site return path instead of preserving it', async () => {
    signedOut()
    await expect(requireAuth('https://evil.example.com')).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    )
  })

  it('derives the return path from the request when none is given', async () => {
    signedOut()
    pathnameHeader.current = '/dashboard/profile'

    await expect(requireAuth()).rejects.toThrow(
      'NEXT_REDIRECT:/login?next=%2Fdashboard%2Fprofile',
    )
  })

  it('ignores an unsafe path in the request header', async () => {
    signedOut()
    pathnameHeader.current = 'https://evil.example.com'

    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('lets a signed-in user through', async () => {
    signedIn()
    profileRole('student')

    const context = await requireAuth()
    expect(context.user).toEqual(USER)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('requireAdmin', () => {
  it('redirects an anonymous visitor to /login', async () => {
    signedOut()
    pathnameHeader.current = '/admin'
    await expect(requireAdmin()).rejects.toThrow(
      'NEXT_REDIRECT:/login?next=%2Fadmin',
    )
  })

  it.each(['student', 'instructor'] as const)(
    'denies a signed-in %s',
    async (role) => {
      signedIn()
      profileRole(role)
      await expect(requireAdmin()).resolves.toBeNull()
    },
  )

  it('denies a user whose profile could not be read', async () => {
    signedIn()
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    // Fail closed: no readable role means no admin access.
    await expect(requireAdmin()).resolves.toBeNull()
  })

  it('allows an admin', async () => {
    signedIn()
    profileRole('admin')

    const context = await requireAdmin()
    expect(context).not.toBeNull()
    expect(context?.profile?.role).toBe('admin')
  })

  it('reads the role from the database, not from the session object', async () => {
    // A user whose JWT metadata claims admin but whose profile row says
    // student must still be denied.
    getUserMock.mockResolvedValue({
      data: {
        user: { ...USER, user_metadata: { role: 'admin' }, role: 'admin' },
      },
      error: null,
    })
    profileRole('student')

    await expect(requireAdmin()).resolves.toBeNull()
  })
})
