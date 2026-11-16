---
'@credo-ts/openid4vc': patch
---

A `did` credential binding takes `createdForCredential`. Set it when the binding resolver creates the DIDs only for this credential. The credential record then stores them, and deleting the credential with `deleteAssociatedKeys` also deletes the DID records and their keys. Deferred credential responses return the DIDs as `holderBindingDids`. Pass them on to `requestDeferredCredentials`.

