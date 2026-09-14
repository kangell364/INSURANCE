/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL = { ...process.env }

async function loadEnv() {
  vi.resetModules()
  return import('@/lib/env')
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.NEXT_PUBLIC_SITE_URL
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe('isSupabaseConfigured', () => {
  it('is false when nothing is set', async () => {
    const { isSupabaseConfigured } = await loadEnv()
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('is false when only one of the two variables is set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    const { isSupabaseConfigured } = await loadEnv()
    expect(isSupabaseConfigured()).toBe(false)
  })

  it('is true when both are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const { isSupabaseConfigured } = await loadEnv()
    expect(isSupabaseConfigured()).toBe(true)
  })
})

describe('publicEnv', () => {
  it('names every missing variable in the error', async () => {
    const { publicEnv, SupabaseConfigError } = await loadEnv()

    try {
      publicEnv()
      expect.unreachable('publicEnv() should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseConfigError)
      expect((error as Error).message).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect((error as Error).message).toContain(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      )
      expect((error as Error).message).toContain('.env.example')
    }
  })

  it('defaults the site URL so local development needs no extra setup', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const { publicEnv } = await loadEnv()

    expect(publicEnv().siteUrl).toBe('http://localhost:3000')
  })

  it('exposes only the public values — never the service-role key', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role-key'
    const { publicEnv } = await loadEnv()

    const values = publicEnv()
    expect(Object.keys(values).sort()).toEqual([
      'siteUrl',
      'supabaseAnonKey',
      'supabaseUrl',
    ])
    expect(JSON.stringify(values)).not.toContain('super-secret')
  })
})
