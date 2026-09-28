---
"@credo-ts/openid4vc": patch
---

fix(openid4vc): support bearer credentials over OpenID4VCI

Neither side could handle a credential that is not bound to holder key material. The issuer
rejected every credential request without `proof`/`proofs` with `invalid_proof: Missing required
proof(s) in credential request`, and the holder refused to build such a request at all, throwing
`Credentials not bound to keys are not supported at the moment`. OpenID4VCI 1.0 only requires proofs
when `proof_types_supported` is present (§8.2) and §14.2 explicitly allows bearer credentials, so
both were wrong.

`proof_types_supported` was only introduced after draft 11, so an absent value in draft 11 metadata
says nothing and a `jwt` proof is still implied. From draft 12 onwards an absent value means the
issuer does not require a proof. Both sides now decide on that basis: the issuer keys off the
negotiated session version, the holder off `metadata.originalDraftVersion`. A proof that arrives for
a configuration advertising no proof types is still verified and the credential is bound to it, so
wallets that always send one keep working.

On the issuer, `holderBinding` in `OpenId4VciCredentialRequestToCredentialMapperOptions` is now
optional and is undefined for these requests, where a single credential without holder binding should
be returned. Mappers that read `holderBinding.keys` need to handle that. On the holder,
`credentialBindingResolver` is now optional and is not called when no proof is required; the nonce is
no longer fetched for offers that need no proof, which previously sent a proof-free dummy request
purely to harvest a `c_nonce` from the resulting error.
