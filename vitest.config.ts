import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `server-only` throws on import outside an RSC environment. Stub it so
      // server modules can be unit tested; the real guard is unaffected in the
      // application build.
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  // Components under test never assert on styles, and Tailwind's PostCSS
  // plugin is not loadable outside the Next build pipeline. Opt out entirely.
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
