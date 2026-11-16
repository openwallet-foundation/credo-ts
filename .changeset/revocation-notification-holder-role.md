---
'@credo-ts/didcomm': patch
---

Revocation notifications only update the holder's credential exchange record. Before, a notification from the holder could also match the issuer's own record of the same exchange.
