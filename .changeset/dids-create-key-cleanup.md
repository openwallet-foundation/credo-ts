---
'@credo-ts/core': patch
---

When creating a did:key, did:jwk or did:peer fails, the key that was created for it is now deleted. Other DID registrars can do the same with the new `deleteDidKeys`.
