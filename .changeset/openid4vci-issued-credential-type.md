---
'@credo-ts/openid4vc': patch
---

The holder now rejects a credential that is not of the type of the credential configuration it requested: an SD-JWT VC with another `vct`, an mdoc with another `doctype`, or a W3C credential whose `type` does not include each type of the `credential_definition` (OpenID4VCI 1.0 Appendix A). Before, it accepted any credential that verified. An SD-JWT VC whose type metadata extends the `vct` of the credential configuration is still accepted.

The issuer now rejects a W3C credential from the `credentialRequestToCredentialMapper` whose `type` does not include each type of the `credential_definition`, as it already did for the `vct` and `doctype`. It also checks the format the mapper returns against the credential configuration, including whether a `vc+sd-jwt` configuration expects an SD-JWT VC (with a `vct`) or a W3C VC (with a `credential_definition`).
