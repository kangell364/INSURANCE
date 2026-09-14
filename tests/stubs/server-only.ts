/**
 * Test stub for the `server-only` package.
 *
 * The real package throws when imported outside a React Server Component, so
 * modules that guard themselves with it cannot be unit tested without this
 * alias. It is wired up in vitest.config.ts and never used at build time —
 * the real guard still applies to the application bundle.
 */
export {}
