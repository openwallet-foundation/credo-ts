---
'@credo-ts/core': patch
---

Reject invalid public-key lengths and non-compressed EC representations when decoding multicodec fingerprints, including did:key and Multikey inputs. General public-key imports and existing DID Document representations remain unchanged.
