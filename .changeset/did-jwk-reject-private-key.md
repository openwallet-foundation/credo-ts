---
'@credo-ts/core': patch
---

A `did:jwk` whose JWK contains a private key is now rejected, as the did:jwk spec requires. Before, an Ed25519 or X25519 key with a `d` member was accepted.
