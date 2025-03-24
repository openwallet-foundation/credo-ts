---
'@credo-ts/anoncreds': patch
'@credo-ts/askar': patch
'@credo-ts/core': patch
---

- Remove usage of Big Number libraries and rely on native implementations
- By default rely on uncompressed keys instead of compressed (for P256, P384, P521 and K256)
- Utilze Uint8Array more instead of Buffer (i.e. for internally representing a key)
