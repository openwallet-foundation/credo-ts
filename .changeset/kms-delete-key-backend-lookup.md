---
'@credo-ts/core': patch
---

`agent.kms.deleteKey` without `backend` now deletes the key from the backend that holds it, like `sign`, `verify`, `encrypt` and `decrypt` already did. Before, it only tried the default backend and returned `false` for a key on another backend.
