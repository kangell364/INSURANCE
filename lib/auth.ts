import 'server-only'

/**
 * Server-side authentication and authorization helpers.
 *
 * Rules this module exists to enforce:
 *   * Identity always comes from `supabase.auth.getUser()`, which verifies the
 *     JWT with the Auth server. `getSession()` merely decodes a cookie the
 *     browser sent and is never used for an authorization decision.
 *   * The role always comes from the `profiles` table, read under RLS. It is
 *     never read from a cookie, localStorage, a URL parameter, or anything
 *     else the client controls.
 *   * These checks run in Server Components, so they cannot be skipped by a
 *     client that disables JavaScript or edits the bundle.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import { isSafeReturnPath, loginUrl } from '@/lib/navigation'
import { PATHNAME_HEADER } from '@/lib/supabase/proxy'
import type { Profile } from '@/types'

export type AuthContext = {
  user: User
  profile: Profile | null
  /**
   * Set when the user is authenticated but their profile row could not be
   * read. The signup trigger makes this very unlikely, but the UI still needs
   * to degrade gracefully rather than crash.
   */
  profileError: string | null
}

/** The signed-in user, or null. Never throws on an anonymous request. */
export async function getUser(): Promise<User | null> {
  // Without configuration there is no auth service to ask, so there is no
  // authenticated user. Returning null (rather than letting publicEnv() throw)
  // means a misconfigured deployment redirects to /login — which explains what
  // is missing — instead of serving a 500 on every protected page.
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}

/**
 * The signed-in user together with their profile row, or null when anonymous.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    // Log for operators; never surface the raw Postgres message to the user.
    console.error('[auth] failed to load profile', {
      userId: user.id,
      code: error.code,
      message: error.message,
    })
    return {
      user,
      profile: null,
      profileError:
        'We could not load your profile. Please try again in a moment.',
    }
  }

  return {
    user,
    profile: data,
    profileError: data
      ? null
      : 'Your profile record is missing. Please contact support.',
  }
}

/**
 * The path the browser actually requested, as forwarded by the proxy.
 *
 * Falls back to null when the header is absent (a direct render in a test, or
 * a path the proxy matcher skips). Validated before use so that even a header
 * that somehow arrived from outside cannot become an off-site redirect.
 */
async function currentPath(): Promise<string | null> {
  const headerList = await headers()
  const path = headerList.get(PATHNAME_HEADER)
  return isSafeReturnPath(path) ? path : null
}

/**
 * Requires an authenticated user. Redirects to /login with a return path when
 * there is none.
 *
 * `returnTo` is optional: when omitted, the path the browser requested is
 * used, so a layout does not have to guess which of its children is rendering.
 */
export async function requireAuth(returnTo?: string): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context) redirect(loginUrl(returnTo ?? (await currentPath())))
  return context
}

/**
 * Requires an authenticated administrator.
 *
 * Unauthenticated -> redirect to /login (there is nothing to deny yet).
 * Authenticated but not an admin -> returns `null` so the caller can render a
 * proper "access denied" page. Redirecting instead would tell an attacker
 * nothing useful, but it also hides a genuine permissions problem from a
 * legitimate staff member who expected access.
 *
 * The role is read from the database on every request.
 */
export async function requireAdmin(
  returnTo?: string,
): Promise<AuthContext | null> {
  const context = await requireAuth(returnTo)
  if (context.profile?.role !== 'admin') return null
  return context
}

export { isSafeReturnPath, loginUrl, safeReturnPath } from '@/lib/navigation'
