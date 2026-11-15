---
'@credo-ts/anoncreds': minor
---

The storage migration from version 0.4 to 0.5 does not resolve the `did:sov` DID of an issuer anymore to find the indy namespace of a credential with unqualified identifiers. The migration reads the namespace from the cache that the indy-vdr pool service wrote when the credential was issued, and it fails for the credential when the namespace is not cached.
