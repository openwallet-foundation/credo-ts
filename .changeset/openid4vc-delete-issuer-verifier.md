---
'@credo-ts/openid4vc': patch
---

Add `deleteIssuer` to the issuer API and `deleteVerifier` to the verifier API. With the tenants module, requests for a deleted issuer or verifier no longer reach the tenant, and its id can be reused in another tenant.

- `deleteIssuer` also deletes the access token signing key and the credential request encryption keys in `jwks` and `previousJwks`, unless `deleteAssociatedKeys` is `false`.
- `deleteIssuer` and `deleteVerifier` throw while the issuer or verifier still has sessions.
- `createIssuer` and `createVerifier` throw if the id is already in use, or with tenants if another tenant uses it for an issuer or verifier.
- Concurrent creates in one tenant no longer drop each other's ids on storage backends that support locking.
