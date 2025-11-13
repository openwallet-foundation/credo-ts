import { defineConfig } from 'vitest/config'

// NOTE: we use vite-rolldown instead of vite. Vite is migrating from
// using ESBuild to Rolldown. The bundler we use `tsdown`, is also built
// on Rolldown, which means it has the same features. Specifically ESBuild
// does not support emitting decorator metadata, a feature we rely on heavily
// for class-transformer, class-validator and tsyringe.

export default defineConfig({
  test: {
    // Ideally we move away from globals, but this
    // makes the migration from jest a lot easier
    globals: true,
    watch: false,

    // hooks sometimes interact with ledger etc, so it needs to be longer than default 10000
    hookTimeout: 40000,
    testTimeout: 120000,

    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: ['**/*.{js,jsx,ts,tsx}'],
      exclude: ['/build/', '/node_modules/', '/__tests__/', 'tests', 'coverage'],
    },

    // Enable for debugging
    logHeapUsage: true,

    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
          // Ignore e2e tests
          exclude: ['**/node_modules/**', '**/build/**', '**/*.e2e.{test,spec}.?(c|m)[jt]s?(x)'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['**/*.e2e.{test,spec}.?(c|m)[jt]s?(x)'],
          // Ignore drizzle tests
          exclude: ['**/node_modules/**', '**/build/**', '**/*.drizzle.e2e.{test,spec}.?(c|m)[jt]s?(x)'],
        },
      },
      {
        extends: true,
        test: {
          name: 'drizzle',
          include: ['**/*.drizzle.e2e.{test,spec}.?(c|m)[jt]s?(x)'],
        },
      },
    ],
  },
})
