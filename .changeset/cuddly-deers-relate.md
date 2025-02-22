---
'@credo-ts/core': patch
---

allow kid (when not a did) to be combined with x5c/jwk header params in JWT/JWS. This is a pattern commonly used and breaks interop with Credo.
