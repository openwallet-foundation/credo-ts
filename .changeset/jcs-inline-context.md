---
'@credo-ts/core': patch
---

Fixed `eddsa-jcs-2022` proof verification rejecting documents whose `@context` contains an inline context object. The `@context` entries of the document and the proof are now compared by value.
