---
'@credo-ts/core': patch
---

`X509Service.validateCertificateChain` now requires the built chain to start with the presented chain. It may continue with trusted certificates that weren't presented, such as the root. Before, the presented chain `[leaf, intermediate]` could build `[leaf, root]`, and the intermediate was never checked. Its authority key identifier could still match DCQL `trusted_authorities`, and out-of-order chains were accepted. This applies to SD-JWT VC `x5c`, mdoc `x5chain` and JWS `x5c`.
