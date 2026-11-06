---
'@credo-ts/node': patch
---

ECDH-ES with `A192GCM` content encryption in the node KMS now uses a 192 bit key, so it no longer fails.
