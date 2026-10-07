---
'@credo-ts/core': patch
---

did:jwk DID documents now keep a `kid` that is encoded in the DID. A `kid` that is only set on the local `PublicJwk` instance no longer ends up in the document.
