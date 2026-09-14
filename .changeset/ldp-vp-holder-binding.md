---
"@credo-ts/core": patch
---

fix(vc): bind the holder to the credentialSubject when verifying JSON-LD (ldp_vp) presentations

`W3cJsonLdCredentialService.verifyPresentation` verified the presentation proof and each embedded
credential's issuer proof, but never checked that the presentation signer (holder) controls the
`credentialSubject.id` of the embedded credentials. The underlying `@digitalcredentials/vc` /
`jsonld-signatures` libraries do not perform this check either. As a result an `ldp_vp` could be used
to present someone else's credential (a data object, not a secret) wrapped in a presentation signed
with the attacker's own key. This check is already enforced for `jwt_vp` and SD-JWT presentations;
the JSON-LD path now enforces it too, surfacing the result per credential under
`credentials[].credentialSubjectAuthentication` to match the `jwt_vp` result shape.
