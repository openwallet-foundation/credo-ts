---
'@credo-ts/core': patch
---

Several crypto fixes:

- `JwsService` now rejects a JWS with a `crit` or `b64` protected header parameter. It supports neither, and before it ignored them.
- `CredoWebCrypto.getRandomValues` now fills the array it's given. Before, it returned a new array and left the argument untouched.
- `KeyManagementApi.getPublicKey` now returns the key from the provided `backend`. Before, it only checked the key existed there and then returned the key from the first backend that had one.
- `areObjectsEqual` no longer treats an array and an object with the same entries as equal, or arrays of different length as equal.
