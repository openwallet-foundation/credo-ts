---
'@credo-ts/core': patch
---

Fixed the status list signer check for a did issuer of an SD-JWT VC. A status list JWT whose `iss` is the trusted issuer did but whose `kid` is an absolute did url of another did is now rejected, the same way the `kid` of the credential itself is checked. Before, the agent verified the status list JWT with the key of that other did.
