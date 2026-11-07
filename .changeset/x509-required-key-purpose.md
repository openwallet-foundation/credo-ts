---
'@credo-ts/core': patch
---

Added the `requiredKeyUsages` and `requiredExtendedKeyUsages` options to `X509Service.validateCertificateChain`, to verify the purpose of the leaf certificate. Failed checks are reported in the `keyUsage` and new `extendedKeyUsage` validations of the validation result.

Added the `requireStatusSigningKeyPurpose` option to the `TokenStatusListModule`. When enabled, the x509 signer of the status list of an SD-JWT VC or mdoc, or of the identifier list of an mdoc, must have the `id-kp-oauthStatusSigning` extended key usage (`X509ExtendedKeyUsage.OauthStatusSigning`), and `digitalSignature` if it has a Key Usage extension. A credential issuer that signs the status or identifier list with the same key as the credential is exempt. The option is disabled by default, as the extended key usage is only recommended by the Token Status List draft and optional in ISO/IEC 18013-5.

Added `X509Certificate.hasExtension`.
