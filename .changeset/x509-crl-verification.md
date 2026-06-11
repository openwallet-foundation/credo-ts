---
"@credo-ts/core": patch
---

Add X.509 CRL (Certificate Revocation List) verification. Certificate chain validation can now check certificate revocation status against the CRLs referenced in each certificate's CRL Distribution Points extension, with configurable `SoftFail`/`Require`/`Disabled` modes, reason partitioning (RFC 5280 §5.2.5), optional caching and full-chain checking. The certificate creation API also gained support for revocation reasons on CRL distribution points, and a new `createCertificateRevocationList` API (`X509Api`/`X509Service`) for creating and signing CRLs.
