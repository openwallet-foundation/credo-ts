---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
'@credo-ts/openid4vc': minor
'@credo-ts/cheqd': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/hedera': patch
'@credo-ts/webvh': patch
---

Records now store KMS keys as a `KmsKeyReference` (`{ keyId, kmsBackend }`), so key operations no longer search every backend. Older records still work. Create keys you pass to Credo with `PublicJwk.fromKmsKey(await agent.kms.createKey(...))` to keep the backend. The did:key, did:jwk, did:peer and did:cheqd registrars accept a `backend` in `createKey`, and the chained authorization server takes `dpop.kmsBackend`.

Breaking changes:

- `JwsService` and `DidCommV2Signer` take `key` instead of `keyId`, and `JweService` takes `recipientKey` instead of `recipientKeyId`. With a `PublicJwk` the KMS checks that it matches the signing key, so a JWT signed with a DID whose record points at another key now fails.
- `MdocVerificationSessionRecord.sessionKeyId` is now `sessionKey`.
- `createIssuer` and `rotateAccessTokenSigningKey` take `accessTokenSigner` (a `PublicJwk`, a `KmsKeyReference` or `{ createKey }`) instead of `accessTokenSignerKeyType` and `accessTokenSignerKmsBackend`. The issuer stores it in `accessTokenKey`. Older issuers move to it when the key is rotated.
- Wallet attestations take their key as `walletAttestationKey`, and key attestation bindings require the attested keys as `keys`.
- Credo no longer sends KMS key ids as `kid` in JWT `jwk` headers, mdoc and DC API structures. Encryption keys in issuer, holder and verifier metadata use the JWK thumbprint as `kid`. Responses to existing verification sessions still decrypt.
