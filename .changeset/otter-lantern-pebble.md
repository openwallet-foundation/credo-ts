---
'@credo-ts/core': patch
'@credo-ts/cheqd': patch
---

Require `@stablelib/ed25519` `^2.1.1`, which fixes Ed25519 signature malleability ([GHSA-x3ff-w252-2g7j](https://github.com/advisories/GHSA-x3ff-w252-2g7j)) in versions up to 2.0.2.
