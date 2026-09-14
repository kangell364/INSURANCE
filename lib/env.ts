/**
 * Centralised, validated access to the environment.
 *
 * Reading `process.env` directly all over the codebase makes configuration
 * errors surface as confusing runtime crashes deep inside Supabase. Doing it
 * here means one clear message that names the missing variable.
 *
 * IMPORTANT: only `NEXT_PUBLIC_*` values may be referenced from code that can
 * run in the browser. `serverEnv()` is never imported by a Client Component.
 */

export class SupabaseConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Supabase is not configured. Missing environment variable(s): ${missing.join(
        ', ',
      )}. Copy .env.example to .env.local and fill in the values from your ` +
        `Supabase project settings.`,
    )
    this.name = 'SupabaseConfigError'
  }
}

export type PublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  siteUrl: string
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * written as a full static member expression, so these must not be looked up
 * dynamically.
 */
function readPublicEnv(): { values: Partial<PublicEnv>; missing: string[] } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  const missing: string[] = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return {
    values: { supabaseUrl, supabaseAnonKey, siteUrl },
    missing,
  }
}

/** True when both public Supabase variables are present. */
export function isSupabaseConfigured(): boolean {
  return readPublicEnv().missing.length === 0
}

/**
 * Returns the validated public environment, or throws SupabaseConfigError
 * naming exactly what is missing.
 */
export function publicEnv(): PublicEnv {
  const { values, missing } = readPublicEnv()
  if (missing.length > 0) throw new SupabaseConfigError(missing)

  return {
    supabaseUrl: values.supabaseUrl as string,
    supabaseAnonKey: values.supabaseAnonKey as string,
    // Used only to build auth redirect URLs; a sensible local default keeps
    // `npm run dev` working with no extra setup.
    siteUrl: values.siteUrl || 'http://localhost:3000',
  }
}
