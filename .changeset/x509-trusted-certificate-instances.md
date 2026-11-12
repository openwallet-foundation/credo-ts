---
'@credo-ts/core': minor
'@credo-ts/openid4vc': patch
---

Trusted certificates can now be passed as `X509Certificate` instances everywhere a base64 or PEM string was accepted: the `getTrustedIssuersForVerification` and `getTrustedCertificatesForVerification` callbacks (`issuance` and `status`), and the `trustedCertificates` options of the SD-JWT VC, mdoc, JWS and OpenID4VC APIs. An instance is used as it is, so it is not parsed again on every verification.

`X509ModuleConfig.trustedCertificates` now returns the `X509Certificate` instances instead of PEM strings. Use `certificate.toString('pem')` to get the PEM string.
