import 'server-only'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Still the anon key, still fully governed by RLS — "server" here refers to
 * where the code runs, not to elevated privileges. The important difference
 * from the browser client is that this one reads and writes the auth cookies
 * through Next's `cookies()` store so the session survives navigation.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabaseAnonKey } = publicEnv()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components may not mutate cookies. This is expected and
          // harmless: the middleware refreshes the session on every request,
          // so the cookie is written there instead.
        }
      },
    },
  })
}
