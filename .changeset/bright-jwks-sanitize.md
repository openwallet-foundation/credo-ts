---
'@credo-ts/core': patch
---

When signing an SD-JWT VC, Credo's issuer-side flow sanitizes the holder's supplied JWK before including it in the issued credential's `cnf.jwk` claim, retaining only its JWK thumbprint components.
