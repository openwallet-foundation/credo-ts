---
'@credo-ts/askar': patch
'@credo-ts/didcomm': patch
---

Remove duplicate error-level logging at throw sites that already chain the original error as `cause`.
