---
"@credo-ts/core": patch
---

Validate public-key payload lengths and compressed EC encodings inside fromMulticodec, including direct decoder calls. Existing multicodec prefix fields, valid fingerprints, and general public-key imports remain unchanged.
