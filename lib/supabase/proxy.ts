import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/** Route prefixes that require a signed-in user. */
const PROTECTED_PREFIXES = ['/dashboard', '/admin']

/**
 * Routes a signed-in user has no reason to see; they are bounced to the
 * dashboard.
 *
 * `/reset-password` IS NOT AND MUST NOT BE IN THIS LIST, despite looking like
 * it belongs. A password-recovery link signs the visitor in — that is how
 * Supabase recovery works, the token is exchanged for a short-lived session
 * before the page renders — so treating it as an "auth only" route would
 * redirect every single person who clicks a reset email straight to the
 * dashboard, without ever showing them the form. The reset would appear to do
 * nothing, and the cause would be nowhere near the symptom.
 *
 * `/forgot-password` is also left out: somebody who is signed in but has
 * forgotten the password they use elsewhere can still legitimately ask for a
 * reset link.
 */
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
  try {
    return await refreshSession(request)
  } catch (error) {
    // THE WHOLE SITE 500s IF THIS THROWS.
    //
    // This runs on every matched request, so an exception here is not a
    // degraded page -- it is an outage, including the marketing pages that
    // need no session at all. It happened: a malformed NEXT_PUBLIC_SUPABASE_URL
    // (a stray character is enough) makes createServerClient throw `Invalid
    // URL`, and every route returned 500 with nothing to say why.
    //
    // isSupabaseConfigured() only proves the variables are PRESENT. It cannot
    // prove they are well-formed, and a value that is present but wrong is the
    // more likely mistake -- somebody pasting into a dashboard field.
    //
    // So: log it where the operator will find it, and fall through to an
    // unauthenticated pass. The session is not refreshed and protected routes
    // lose this convenience redirect, but lib/auth.ts re-validates every
    // protected page server-side and RLS enforces the rest. The security
    // boundary is unaffected; only the convenience is.
    console.error('[proxy] session refresh failed, passing through:', error)
    return passThrough(request)
  }
}

async function refreshSession(request: NextRequest) {
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
