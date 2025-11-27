---
"@credo-ts/askar-to-drizzle-storage-migration": minor
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

Add support for ESM module syntax.

- Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
- Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
- Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module. 

Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.