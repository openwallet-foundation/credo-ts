---
"@credo-ts/core": patch
---

Use the `alg` from the JWS header when verifying linked data proofs, and bind signing to the algorithm declared in the JWS header, instead of using the first supported signature algorithm of the key. Also fixes the JWS header validation for linked data proofs, which could previously be bypassed by adding an extra header parameter.
