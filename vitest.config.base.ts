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
  },
})
