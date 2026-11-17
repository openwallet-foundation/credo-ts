---
'@credo-ts/cheqd': patch
---

Fix `CheqdDidRegistrar`/`CheqdDidResolver` issues found through extended e2e coverage:

- `CheqdDidRegistrar` no longer assumes every key is Ed25519 — it now accepts any key type `did:cheqd` supports and fails with a clear `unsupported key for did:cheqd` reason instead of a silent type mismatch, and can produce a `JsonWebKey2020` verification method in addition to the existing `JsonWebKey2020`/`Ed25519VerificationKey2020` paths.
- Fixes resource fee/version handling and base64/base64url decoding edge cases surfaced by the new e2e tests (`cheqd-did-registrar.e2e.test.ts`, `cheqd-did-resolver.e2e.test.ts`, `cheqd-closest-resource-version.test.ts`, `cheqd-resource-data-decoding.test.ts`, `cheqd-fees.e2e.test.ts`, `cheqd-live-writes.e2e.test.ts`, `cheqd-live-compat.e2e.test.ts`).
- Adds end-to-end coverage for issuing and verifying OpenID4VC credentials against `did:cheqd`.
