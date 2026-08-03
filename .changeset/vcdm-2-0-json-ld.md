---
"@credo-ts/core": minor
"@credo-ts/didcomm": minor
---

feat: support Verifiable Credentials Data Model 2.0 for JSON-LD credentials

`W3cCredential` and `W3cPresentation` now accept the `https://www.w3.org/ns/credentials/v2` context in addition to `https://www.w3.org/2018/credentials/v1`, so data model 2.0 credentials can be issued and verified using Data Integrity (linked data) proofs. Previously data model 2.0 was only supported through the enveloping `W3cV2*` models (JWT and SD-JWT).

- `W3cCredential` gained the data model 2.0 `validFrom` and `validUntil` properties. Which date properties are valid is now derived from the credential's base context: `issuanceDate`/`expirationDate` are required/allowed only for data model 1.1, `validFrom`/`validUntil` only for data model 2.0. `issuanceDate` is therefore no longer unconditionally required.
- Added `credential.dataModelVersion`, plus the version-agnostic `credential.validFromDate` and `credential.validUntilDate` getters.
- The data model 2.0 context (`https://www.w3.org/ns/credentials/v2`) is now bundled in `DEFAULT_CONTEXTS`, so it resolves without a network request.
- `IsCredentialJsonLdContext` accepts a list of credential contexts through its `credentialContext` option.
- Constructing a `W3cCredential` or `W3cPresentation` without an `id` no longer serializes an `id` key with an undefined value, which produced an invalid JSON-LD document.

Securing a data model 2.0 credential with the data model 1.1 JWT VC envelope now throws a descriptive error pointing at `W3cV2Credential`.
