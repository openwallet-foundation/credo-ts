---
'@credo-ts/core': patch
---

Reading an extension of an `X509Certificate`, such as the authority key identifier, no longer fails or returns nothing when a different extension of the certificate can't be decoded.
