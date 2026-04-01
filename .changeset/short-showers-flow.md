---
"@credo-ts/askar-to-drizzle-storage-migration": minor
"@credo-ts/react-native": minor
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
"@credo-ts/node": minor
---

- Removed buffer dependency and replaced with `@scure/base` for base-x encoding/decoding
- Updated DIDComm attachments to use base64url, not base64
- Updated tests to make sure urland base64 encoded items use base64url
- Added `fromBase64Url` to `TypedArrayEncoder` and `JsonEncoder`

Breaking changes: 1. `TypedArrayEncoder.fromBase64` does not support base64url anymore, please use `TypedArrayEncoder.fromBase64Url` for that. Same for `JsonEncoder` 2. `TypedArrayEncoder.fromString` has been replaced by `TypedArrayEncoder.fromUtf8String` to be consistent with `TypedArrayEncoder.toUtf8String` 3. Every place where we accepted `Buffer` as input we now only support `Uint8Array` as input 4. `TypedArrayEncoder.equals` is now constant-time, however I would still hesitate to use it for any private crypto operation 5. Removed `Uint8ArrayBuffer` type, not used anymore
