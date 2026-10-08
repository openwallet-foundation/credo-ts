---
'@credo-ts/node': patch
---

The node KMS now returns `Uint8Array` instead of `Buffer` from `randomBytes`, `sign`, `encrypt` and `decrypt`.
