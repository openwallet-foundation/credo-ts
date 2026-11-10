---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

Fixed a regression since 0.7.1 where an `ldp_vc` or `ldp_vp` could not be signed with an `Ed25519VerificationKey2020` method. Each Ed25519 suite only accepts its own verification method type, but OpenID4VCI issuance, DCQL and Presentation Exchange still chose the suite by key type and picked `Ed25519Signature2018`. They now choose by verification method type, using the new `SignatureSuiteRegistry.getAllByVerificationMethod`.

`proofType` is now optional when signing a JSON-LD credential. When it is omitted, the first suite that supports the verification method type is used, so callers no longer have to look up the verification method separately before signing. OpenID4VCI `ldp_vc` issuance relies on this, so the issuer method is looked up under `assertionMethod`, as signing does, and issuer keys listed only under `assertionMethod` now work. Failures still throw `W3cJsonLdCredentialSigningNotSupportedError`. The OpenID4VCI holder now also requests an `ldp_vc` with `EdDSA` when the issuer only supports `Ed25519Signature2020`.
