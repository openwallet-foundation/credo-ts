---
'@credo-ts/core': minor
---

`X509Service.validateCertificateChain` now parses each certificate once and verifies each signature in the chain once. It used to parse the chain and the trusted certificates about five times, and to verify each signature twice. The `certificateChain` and `trustedCertificates` options also accept `X509Certificate` instances, which are used as they are and returned in the validated chain.

When a certificate can not be parsed because its key type is not supported, the error message is now `Error during parsing of x509 certificate`, as for other parsing errors.

The chain is no longer built by searching for issuers. Every certificate in `certificateChain` must be issued by the next one, and only trusted certificates are used to complete the chain. A chain that breaks this is rejected with `Certificate: '<subject>' is not issued by the next certificate in the chain: '<subject>'`.

The `trustedCertificates` option of `validateCertificateChain` is now required. Without it, a chain that ended in any self-signed root was accepted, also when that root was not trusted. Pass the certificates you trust. A chain is rejected with `No trusted certificate was found while validating the X.509 chain` when none of them is part of it.

The `certificate` option of `validateCertificateChain` is removed. It had to be the first certificate of `certificateChain`, which is the certificate that is validated.

When several trusted certificates can complete the chain, one that is valid on the verification date is now used before an expired one. A trusted root that was renewed with the same name and key no longer fails the chain when the expired root comes first in `trustedCertificates`.

A certificate whose authority key identifier names its issuer by issuer name and serial number, without a key identifier, is now accepted when the issuer has a subject alternative name. Before, chain validation failed with an error.

With `allowNonRootTrustedCertificate: false`, a chain that ends in a trusted self-signed root is now accepted. Before, it was rejected as if the root was a trusted non-root certificate.
