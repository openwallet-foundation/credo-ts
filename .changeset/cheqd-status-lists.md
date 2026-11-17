---
'@credo-ts/cheqd': minor
---

Add support for two cheqd-hosted credential status list formats, both published and read as DID-Linked Resources:

- **Legacy bitstring status list**: `createLegacyStatusList`/`updateLegacyStatusList`, `setLegacyCredentialStatus`/`checkLegacyCredentialStatus`, and `checkLegacyPresentationStatus` for checking and updating revocation/suspension status on credentials and presentations that use cheqd's existing resource-based status list convention.
- **Token Status List** ([draft-ietf-oauth-status-list](https://www.ietf.org/archive/id/draft-ietf-oauth-status-list-02.html)): `publishTokenStatusList`/`fetchTokenStatusList` publish and read a signed JWT- or CWT-encoded status list as a DID-Linked Resource, and `createCheqdStatusListFetcher` is a `CustomStatusListFetcher` for `SdJwtVcModule` that resolves a cheqd-hosted list straight from the ledger, falling back to the default HTTP fetcher for any other uri.

Both are exposed on `CheqdApi` and exported from `@credo-ts/cheqd`.
