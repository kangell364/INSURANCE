/**
 * @vitest-environment node
 *
 * Runs in the node environment, not jsdom: NextRequest / NextResponse require
 * the real WHATWG Headers implementation, and jsdom substitutes its own.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/* ==========================================================================
   Proxy-level route protection and sign out.

   The proxy is not the security boundary — lib/auth.ts is, and RLS is the
   backstop behind that — but it is what produces the redirect a user actually
   sees, and it is what keeps the session cookie fresh. Both are worth pinning
   down.
   ========================================================================== */

const getUserMock = vi.hoisted(() => vi.fn())
const signOutMock = vi.hoisted(() => vi.fn())
const configuredMock = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: configuredMock,
  publicEnv: () => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
    siteUrl: 'http://localhost:3000',
  }),
  SupabaseConfigError: class extends Error {},
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: getUserMock } }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock, signOut: signOutMock },
  })),
}))

const { updateSession } = await import('@/lib/supabase/proxy')
const { POST: signOut } = await import('@/app/auth/signout/route')

const USER = { id: 'student-1', email: 'ada@example.com' }

function request(path: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'))
}

function signedIn() {
  getUserMock.mockResolvedValue({ data: { user: USER }, error: null })
}

function signedOut() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  configuredMock.mockReturnValue(true)
  signOutMock.mockResolvedValue({ error: null })
})

describe('protected routes', () => {
  it.each([
    '/dashboard',
    '/dashboard/courses',
    '/dashboard/progress',
    '/dashboard/exams',
    '/dashboard/profile',
    '/admin',
  ])('redirects an anonymous visitor away from %s', async (path) => {
    signedOut()

    const response = await updateSession(request(path))
    const location = new URL(response.headers.get('location') as string)

    expect(response.status).toBe(307)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe(path)
  })

  it('preserves the query string in the return path', async () => {
    signedOut()

    const response = await updateSession(request('/dashboard/courses?filter=active'))
    const location = new URL(response.headers.get('location') as string)

    expect(location.searchParams.get('next')).toBe(
      '/dashboard/courses?filter=active',
    )
  })

  it.each(['/', '/courses', '/about', '/contact', '/login', '/signup'])(
    'lets an anonymous visitor reach the public route %s',
    async (path) => {
      signedOut()

      const response = await updateSession(request(path))
      expect(response.headers.get('location')).toBeNull()
    },
  )

  it('lets a signed-in user reach a protected route', async () => {
    signedIn()

    const response = await updateSession(request('/dashboard'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('sends a signed-in user away from the login and signup pages', async () => {
    signedIn()

    for (const path of ['/login', '/signup']) {
      const response = await updateSession(request(path))
      const location = new URL(response.headers.get('location') as string)
      expect(location.pathname).toBe('/dashboard')
    }
  })

  it('does not gate /admin on role — that is the layout and the database', async () => {
    // A signed-in student passes the proxy. requireAdmin() in the layout is
    // what denies them, and RLS is what makes the denial meaningful.
    signedIn()

    const response = await updateSession(request('/admin'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('verifies the token with the auth server rather than trusting the cookie', async () => {
    signedIn()
    await updateSession(request('/dashboard'))

    // getUser() revalidates; getSession() would only decode the cookie.
    expect(getUserMock).toHaveBeenCalled()
  })

  it('does not redirect-loop when Supabase is not configured', async () => {
    configuredMock.mockReturnValue(false)

    const response = await updateSession(request('/dashboard'))
    expect(response.headers.get('location')).toBeNull()
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('treats a path that merely starts with a protected prefix as public', async () => {
    signedOut()

    // "/dashboards-are-great" is not under /dashboard.
    const response = await updateSession(request('/dashboards-are-great'))
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('sign out', () => {
  it('revokes the session and redirects home', async () => {
    signedIn()

    const response = await signOut(
      new NextRequest('http://localhost:3000/auth/signout', { method: 'POST' }),
    )

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(303)
    expect(new URL(response.headers.get('location') as string).pathname).toBe('/')
  })

  it('is harmless for a visitor who is already signed out', async () => {
    signedOut()

    const response = await signOut(
      new NextRequest('http://localhost:3000/auth/signout', { method: 'POST' }),
    )

    expect(signOutMock).not.toHaveBeenCalled()
    expect(response.status).toBe(303)
  })

  it('still clears the session for the user when the revoke call errors', async () => {
    signedIn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutMock.mockResolvedValue({
      error: { code: 'unexpected', message: 'upstream failure' },
    })

    const response = await signOut(
      new NextRequest('http://localhost:3000/auth/signout', { method: 'POST' }),
    )

    // The user is redirected out regardless; the failure is logged, not shown.
    expect(response.status).toBe(303)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('exposes no GET handler, so a prefetch cannot sign a user out', async () => {
    const routeModule = await import('@/app/auth/signout/route')
    expect('GET' in routeModule).toBe(false)
  })
})
