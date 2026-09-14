'use client'

/**
 * Supabase client for Client Components (browser).
 *
 * Uses the anon key only. Every query it makes is subject to Row-Level
 * Security. The service-role key must never reach this file or anything it
 * imports.
 *
 * `createBrowserClient` from @supabase/ssr is already a singleton per browser
 * context — it reuses the same underlying client and keeps the auth session in
 * cookies so the server can read it too.
 */
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = publicEnv()
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
