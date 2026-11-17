---
'@credo-ts/didcomm': patch
---

The `didCommSignedAttachment` holder binding of the W3C VCDM 2.0 SD-JWT and data integrity credential formats takes `deleteWithRecord`. Set it to delete the DID of `kid` with the credential record, so the stored credential record keeps it. It throws for a DID whose method has deactivation. Only a DID whose method has none, such as did:key, can be deleted with the record. The JSON-LD credential format has no holder binding, so `createProposal`, `acceptOffer` and `createRequest` take `deleteDidWithRecord` instead. It names a DID in `credentialSubject.id` to delete with the credential record, and throws when the credential doesn't have it as subject or its method has deactivation. `credentials.deleteById` takes a `deleteAssociatedKeys` option that deletes the holder binding of the associated credentials, including the DID records and keys of these DIDs. For a credential that wasn't received, it deletes the DIDs marked for it.
