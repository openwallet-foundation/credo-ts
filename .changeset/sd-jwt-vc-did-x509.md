---
'@credo-ts/core': minor
'@credo-ts/openid4vc': patch
---

Added support for SD-JWT VCs issued by a `did:x509`. The credential is bound to the did in `iss`, and the certificate chain in the `x5c` header is used as evidence to resolve the did (passed to the did resolver as the `x509chain` resolution option). A did issuer can now be given an `x5c` chain for `did:x509` when signing, and when verifying the chain must anchor in a trusted certificate (`trustedIssuers` with the `x509` method, the trusted issuers callback or the x509 module trusted certificates). A credential with a `did:x509` in `iss` is never handled as a plain `x5c` credential, so a `kid` and an `x5c` header are required. Credo does not ship a `did:x509` resolver, one has to be registered (for example `@didx509/credo`).
