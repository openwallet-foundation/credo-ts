---
'@credo-ts/core': patch
---

Creating and updating a token status list no longer reads the public key from the key management service. A CWT status list takes the key from the `x5c` certificate, and picks COSE Mac0 over Sign1 from the `alg` option instead of the `alg` of the key.
