---
'@credo-ts/core': minor
---

`createKey`, `createKeyForSignatureAlgorithm`, `importKey`, `sign`, `verify`, `encrypt` and `decrypt` of `KeyManagementApi` now also return the `backend` that ran the operation, like `getPublicKey`. Pass it to the next operation on the same key, so its backend isn't looked up again.
