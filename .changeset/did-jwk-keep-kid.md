---
'@credo-ts/core': patch
---

did:jwk DID documents now keep the JWK exactly as it is encoded in the DID, including its `kid`. A `kid` that is only set on the local `PublicJwk` instance no longer ends up in the document.
