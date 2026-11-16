---
'@credo-ts/core': minor
'@credo-ts/node': minor
---

`@credo-ts/node` now hashes with `node:crypto` instead of the JavaScript implementation. It sets this up when imported. Other platforms can plug in a native hash implementation with `Hasher.setImplementation`, which applies to every agent in the process.
