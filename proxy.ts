import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 *
 * This runs before every matched request. Its job is to keep the Supabase auth
 * session fresh (Server Components cannot write cookies) and to bounce
 * anonymous visitors away from protected routes early.
 *
 * It is NOT the security boundary — see lib/supabase/proxy.ts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files, so the auth session
     * cookie is refreshed on ordinary navigations.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
