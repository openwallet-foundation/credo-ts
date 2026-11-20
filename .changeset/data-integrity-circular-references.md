---
'@credo-ts/core': patch
---

Creating or verifying a Data Integrity proof for a document with a circular reference now fails with a `PROOF_TRANSFORMATION_ERROR`. Before, creating a proof threw a `RangeError` and verifying returned a generic verification error. The JCS input check of `eddsa-jcs-2022` also no longer reports a class instance that is used in two places in a document as a circular reference.
