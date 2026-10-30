---
'@credo-ts/openid4vc': minor
---

The holder requests signed credential issuer metadata by default. Configure it with `holder.signedMetadata` (`required`, `preferred` or `disallowed`) on the `OpenId4VcModule`, or override it per call with the `signedMetadata` option of `resolveIssuerMetadata` and `resolveCredentialOffer`. It defaults to `preferred`.

Breaking: with `preferred`, signed metadata is only accepted if the signer is trusted, so resolving metadata of an issuer that signs its metadata with an untrusted certificate now fails. Trust the certificate, or set `signedMetadata` to `disallowed` to keep fetching unsigned metadata.

`OpenId4VciHolderService` now takes an `OpenId4VcHolderModuleConfig` as constructor argument, which is registered by the `OpenId4VcHolderModule`.
