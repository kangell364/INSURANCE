import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'

/**
 * Sign out.
 *
 * POST only. A GET would let a prefetch, a crawler or an `<img>` tag on
 * another site sign the user out, which is a nuisance-grade CSRF.
 *
 * `signOut()` revokes the refresh token server-side and clears the auth
 * cookies, so the session is genuinely terminated rather than merely hidden.
 */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()

    // Only attempt a revoke when there is a verified user; calling signOut on
    // an anonymous request just produces noise in the logs.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[auth] sign-out failed', {
          code: error.code,
          message: error.message,
        })
      }
    }
  }

  // 303 so the browser follows with a GET rather than replaying the POST.
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
