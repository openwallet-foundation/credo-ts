---
'@credo-ts/askar': minor
---

Read the askar native binding via `NativeAskar.instance` instead of the deprecated mutable `askar` export in the KMS (key management and ECDH key derivation). The deprecated binding is populated only when the platform package's side-effect import runs, so an ESM consumer that loads the KMS first snapshots it as `undefined` and key operations fail with `Cannot read properties of undefined (reading 'keyGetJwkSecret')`. `NativeAskar.instance` resolves the binding on each access, so registration order no longer matters. See #2597, #2607.

This raises the minimum required `@openwallet-foundation/askar-shared` to 0.6.0, where `NativeAskar` was introduced, so the peer dependency range is narrowed to `^0.6.0`.
