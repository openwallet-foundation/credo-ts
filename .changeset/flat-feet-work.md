---
"@credo-ts/askar-to-drizzle-storage-migration": patch
"@credo-ts/react-native": patch
"@credo-ts/anoncreds": patch
"@credo-ts/openid4vc": patch
"@credo-ts/indy-vdr": patch
"@credo-ts/didcomm": patch
"@credo-ts/hedera": patch
"@credo-ts/askar": patch
"@credo-ts/cheqd": patch
"@credo-ts/webvh": patch
"@credo-ts/core": patch
"@credo-ts/node": patch
"@credo-ts/action-menu": patch
"@credo-ts/drizzle-storage": patch
"@credo-ts/drpc": patch
"@credo-ts/question-answer": patch
"@credo-ts/redis-cache": patch
"@credo-ts/tenants": patch
---

- Changed all `AnyUint8Array` to `Uint8ArrayBuffer`
- Changed all usages of `Buffer` to `TypedArrayEncoder`
- Replaced all base-x encoders with `@scure/base`, audited micro library for base-x encoding
