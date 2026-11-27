---
'@credo-ts/drizzle-storage': minor
---

`@credo-ts/anoncreds`, `@credo-ts/didcomm`, `@credo-ts/openid4vc` and `@credo-ts/tenants` are now optional peer dependencies instead of dependencies, so installing `@credo-ts/drizzle-storage` no longer installs all of them. Install the module package for every bundle you register in the `DrizzleStorageModule` or pass to the `drizzle-storage` CLI with `--bundle`. For example, `--bundle anoncreds` fails with `Unable to resolve bundle anoncreds` until `@credo-ts/anoncreds` is installed next to `@credo-ts/drizzle-storage`. The bundles now use the module packages installed by your app, instead of a separate copy under `@credo-ts/drizzle-storage`.
