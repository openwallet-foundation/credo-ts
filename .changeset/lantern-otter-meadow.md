---
'@credo-ts/action-menu': patch
'@credo-ts/anoncreds': patch
'@credo-ts/askar': patch
'@credo-ts/askar-to-drizzle-storage-migration': patch
'@credo-ts/cheqd': patch
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/drizzle-storage': patch
'@credo-ts/drpc': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/node': patch
'@credo-ts/openid4vc': patch
'@credo-ts/question-answer': patch
'@credo-ts/react-native': patch
'@credo-ts/redis-cache': patch
'@credo-ts/tenants': patch
'@credo-ts/webvh': patch
---

Update the TypeScript development dependency to TypeScript 7 (`typescript@^7.0.2`, installed as `@typescript/native`) for type checking. The `typescript` package is now an alias of `@typescript/typescript6@^6.0.2`, so tools that use the TypeScript compiler API, such as `tsdown` when generating declaration files, keep working.

This has no effect on runtime behaviour. `getPublicJwkFromDid` in `@credo-ts/openid4vc` now declares its `Promise<PublicJwk>` return type, which is the type it already returned.
