---
'@credo-ts/core': minor
---

The X.509 module now keeps parsed certificates in memory and reuses them, so a certificate that is seen on every request (an issuer chain in an `x5c` header, a trusted certificate passed as PEM) is parsed once. This applies to `agent.x509.parseCertificate` and `agent.x509.validateCertificateChain`, which now also accept a certificate as DER bytes. Every call still returns a new instance with its own `publicJwk`. A certificate is only reused for the exact same encoding and parse options.

Every agent has its own cache with the 250 most recently used certificates of up to 12 KB. Change the limit with the `parsedCertificateCacheLimit` option of the X.509 module, where 0 parses every certificate again.

Credo now parses certificates through the service where it has an agent context. `extractX509CertificatesFromJwt` therefore takes the `agentContext` as its first argument.

`X509Certificate` has the new `clone`, `basicConstraints`, `extensions`, `isPossiblyIssuedBy` and `verifySignature` members. The unused `X509Certificate.privateKey` is removed. `X509Certificate.rawCertificate` and the dates in `X509Certificate.data` are now copies.
