---
'@credo-ts/core': minor
'@credo-ts/openid4vc': minor
---

Signers are no longer trusted by default. Before, a did signer was trusted when the `getTrustedIssuersForVerification` callback returned no result. Now verification fails with `No trusted issuers configured for signer method 'did'`, the same as for x509 signers. This applies to every did signed credential (SD-JWT VC, W3C JWT, JSON-LD and data integrity, and VCDM 2.0 JWT and SD-JWT), also when a holder receives a credential. X509 signers still fall back to the trusted certificates of the X.509 module.

The callback now also supports `jwk` signers. Return a `jwk` trusted issuer to trust a public key:

```ts
getTrustedIssuersForVerification: async (agentContext, { signer }) => {
  if (signer.method === 'did') return { trustedIssuers: [{ method: 'did', issuance: 'did:web:issuer.example.com' }] }
  if (signer.method === 'jwk') return { trustedIssuers: [{ method: 'jwk', issuance: trustedPublicJwk }] }
}
```

For `@credo-ts/openid4vc`, every JWT verified through the OpenID4VC libraries must have a trusted signer. This covers signed authorization requests (JAR), signed credential issuer metadata, and wallet and key attestations. A did or jwk signed authorization request is now rejected unless the wallet trusts the verifier's did or jwk. Wallet and key attestations signed with a `jwk` header are now accepted when the callback trusts the jwk. Only DPoP proofs, client attestation PoPs, credential request proofs, access tokens and id tokens are verified without a trusted signer, as their key is bound by the access token, the client attestation, the nonce or the authorization server configuration. Other JWTs are rejected, including wallet and key attestations verified without an issuance session.
