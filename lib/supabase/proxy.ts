import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/** Route prefixes that require a signed-in user. */
const PROTECTED_PREFIXES = ['/dashboard', '/admin']

/** Routes a signed-in user has no reason to see. */
const AUTH_ONLY_PREFIXES = ['/login', '/signup']

function isMatch(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * Header carrying the requested path down to Server Components.
 *
 * Server Components have no access to the current URL, so without this a
 * layout that redirects to /login can only guess at a return path. The value
 * is set here, by our own code, on every request — it is not attacker
 * controlled in the way an inbound header would be, and lib/auth.ts still runs
 * it through isSafeReturnPath() before using it.
 */
export const PATHNAME_HEADER = 'x-tep-pathname'

function passThrough(request: NextRequest): NextResponse {
  // Re-read request.headers each time: @supabase/ssr mutates request.cookies
  // (and therefore the cookie header) while refreshing the session, and those
  // updates must survive into the forwarded request.
  const headers = new Headers(request.headers)
  headers.set(
    PATHNAME_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  )
  return NextResponse.next({ request: { headers } })
}

/**
 * Refreshes the Supabase auth session on every request and applies a coarse
 * redirect for protected routes.
 *
 * The refresh is the important part: Server Components cannot write cookies,
 * so without this the access token would expire and the user would be
 * silently signed out mid-session.
 *
 * The redirect here is a UX convenience, NOT the security boundary. Every
 * protected page independently re-validates the user server-side (see
 * lib/auth.ts), because this layer can be bypassed by misconfiguration and
 * Next.js has had bypass CVEs in exactly this position. Authorization
 * decisions are made in the page and, ultimately, by Row-Level Security in
 * the database.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = passThrough(request)

  // Without configuration there is no session to refresh. Let the request
  // through so public pages still render and the app can show a clear
  // configuration error instead of a redirect loop.
  if (!isSupabaseConfigured()) return supabaseResponse

  const { supabaseUrl, supabaseAnonKey } = publicEnv()

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = passThrough(request)
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  // getUser() revalidates the token against the Auth server. getSession()
  // only decodes the cookie and must not be trusted for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  if (!user && isMatch(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // Preserve where the user was heading so login can send them back.
    url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (user && isMatch(pathname, AUTH_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
