---
'@credo-ts/openid4vc': patch
---

A `did` credential binding takes `deleteWithRecord`. Set it to delete the DIDs with the credential record. It throws for a DID whose method has deactivation. Only a DID whose method has none, such as did:key, can be deleted with the record. The credential record then stores them, and deleting the credential with `deleteAssociatedKeys` also deletes the DID records and their keys. Deferred credential responses return the DIDs as `holderBindingDids`. Pass them on to `requestDeferredCredentials`.

