## Common Tasks

All should be run from the root of the repository unless specified otherwise

- To test a file run `pnpm test <filename>`
- For linting and formatting run `pnpm style:fix`
- For creating a changeset (changelog entry) run `pnpm changeset`. Changes to `@credo-ts/drizzle-storage` get their own changeset, separate from the package whose records they store.
- To build all packages run `pnpm build`. To build a specific package run `pnpm build` from the package directory.

## Code comments

- Comments explain what the code doesn't show, such as why or a constraint. Keep them short, usually one sentence. This applies to JSDoc too.

## Records

- When adding or changing properties on a `Record` class, also update its drizzle storage: the postgres and sqlite tables and the record adapter in `packages/drizzle-storage/src`, then generate migrations with `pnpm cli:local:generate` from `packages/drizzle-storage`.
