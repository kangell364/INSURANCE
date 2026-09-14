import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import { safeReturnPath } from '@/lib/navigation'

/**
 * Email-confirmation / OAuth callback.
 *
 * Supabase redirects here with a one-time `code`, which is exchanged for a
 * session. The exchange happens server-side so the resulting cookies are set
 * with HttpOnly by @supabase/ssr rather than being handled in client JS.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // `next` arrives in a URL and is therefore untrusted; normalise it so this
  // endpoint can never be used as an open redirect.
  const next = safeReturnPath(searchParams.get('next'))

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=configuration`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth] code exchange failed', {
      code: error.code,
      message: error.message,
    })
    // A generic marker only — the reason is in the server log, not the URL.
    return NextResponse.redirect(`${origin}/login?error=link_invalid`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
