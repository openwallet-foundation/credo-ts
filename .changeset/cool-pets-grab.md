---
'@credo-ts/anoncreds': minor
'@credo-ts/askar': minor
'@credo-ts/core': minor
---

- Rely on Uint8Array instead of Buffer for internal key bytes representation
- Remove dependency on external Big Number libraries
- Default to use of uncompressed keys for Secp256k1, Secp256r1, Secp384r1 and Secp521r1
