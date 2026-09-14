---
"@credo-ts/core": patch
---

Expose the ASN.1 parse options added in `@peculiar/x509` 2.1.0 as `X509ParseOptions` (`maxDepth`, `maxNodes`, `maxContentLength`), bounding the work done when parsing untrusted DER. Pass them to the `X509Certificate`, `CertificateSigningRequest` and `X509CertificateRevocationList` parsing factories, to the `X509Service` and revocation methods that parse, or set `parseOptions` on the X509 module.

The limits are enforced whether or not they are provided, so Credo applies its own `defaultX509ParseOptions`, raising the node limit from 10000 to 1500000 to match the 10 MB CRL the revocation checker downloads; the parser default rejects any CRL with more than about 3300 entries. Options are taken as a whole: a per-call value replaces the module's, which replaces `defaultX509ParseOptions`, and limits left unset fall back to the parser's own.

`X509Service.parseCertificateSigningRequest` now takes an `agentContext` as its first argument, matching every other method on it. `X509Api` is unchanged.
