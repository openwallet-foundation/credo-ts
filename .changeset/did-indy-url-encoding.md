---
'@credo-ts/anoncreds': patch
---

AnonCreds registries can return every form of an id with the new optional `getIdentifierVariants` method, such as did:indy ids with and without percent-encoding. Credo treats these forms as the same id everywhere it looks up or compares ids: records, credential queries, proof request restrictions, proof verification and auto accept.
