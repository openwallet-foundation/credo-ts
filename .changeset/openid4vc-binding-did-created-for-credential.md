---
'@credo-ts/openid4vc': patch
---

The `did` and `jwk` credential bindings take `createdForCredential`. Set it when the binding resolver creates the DIDs or keys only for this credential. The credential record then stores them, and deleting the credential with `deleteAssociatedKeys` also deletes them, with the DID records and their keys. Keys of other bindings are kept. Deferred credential responses return the DIDs as `holderBindingDids` and the keys as `holderBindingKeys`. Pass them on to `requestDeferredCredentials`.
