---
'@credo-ts/core': patch
---

Verifying a Data Integrity proof now rejects it when its `expires` time has passed or its `created` time is in the future, allowing for `validitySkewSeconds`. Before, only the format of `created` and `expires` was checked. This applies to single proofs and to every proof in a proof set or chain. A new `now` verify option sets the time to check against. A `created` or `expires` that is not a string is now also rejected.
