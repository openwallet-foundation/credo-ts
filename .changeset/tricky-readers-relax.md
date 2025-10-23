---
"@credo-ts/askar-to-drizzle-storage-migration": minor
"@credo-ts/indy-sdk-to-askar-migration": minor
"@credo-ts/drizzle-storage": minor
"@credo-ts/question-answer": minor
"@credo-ts/react-native": minor
"@credo-ts/action-menu": minor
"@credo-ts/redis-cache": minor
"@credo-ts/anoncreds": minor
"@credo-ts/openid4vc": minor
"@credo-ts/indy-vdr": minor
"@credo-ts/didcomm": minor
"@credo-ts/tenants": minor
"@credo-ts/hedera": minor
"@credo-ts/askar": minor
"@credo-ts/cheqd": minor
"@credo-ts/webvh": minor
"@credo-ts/core": minor
"@credo-ts/drpc": minor
"@credo-ts/node": minor
---

Add support for both CJS and ESM module syntax.

- Use `tsdown` to bundle for both CJS and ESM (bridge period) -> tsdown is based on rust, so it should help with performance
- Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
- Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.
