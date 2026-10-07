---
'@credo-ts/webvh': patch
---

The did:webvh AnonCreds registry signs again with an `assertionMethod` key of any type Credo maps to an Ed25519 key (`Multikey`, `Ed25519VerificationKey2020`, `Ed25519VerificationKey2018`, `JsonWebKey2020`), preferring `Multikey`. Since #2934 it only looked at `Multikey`, so a DID whose `assertionMethod` key is an `Ed25519VerificationKey2020` could not register a schema, credential definition, revocation registry or status list.
