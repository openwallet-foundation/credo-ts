---
'@credo-ts/core': patch
---

`KeyManagementApi` now picks the backend that holds the key for `encrypt`, `decrypt` and `verify` when no `backend` is given, like `sign` already did. Before, these always used the default backend, so a key that lived in another backend was not found.
