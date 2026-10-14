---
'@credo-ts/core': patch
---

`DidsApi` no longer imports `parseDid` from `@sphereon/ssi-types` and uses Credo's own `parseDid` instead. Parsing behaviour is unchanged. An invalid DID URL passed to `resolveVerificationMethodFromCreatedDidRecord` now throws a `CredoError` ("Error parsing did '…'") instead of a plain `Error('invalid did')`.
