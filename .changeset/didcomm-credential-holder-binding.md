---
'@credo-ts/didcomm': patch
---

The `didCommSignedAttachment` holder binding of the W3C VCDM 2.0 SD-JWT and data integrity credential formats takes `createdForCredential`. Set it when the DID of `kid` was created only for this credential, so the stored credential record keeps it. For the W3C VCDM 2.0 SD-JWT format it also applies to the key of a `jwk` binding. The JSON-LD credential format has no holder binding, so `createProposal`, `acceptOffer` and `createRequest` take `didCreatedForCredential` instead. It names a DID in `credentialSubject.id` that was created only for this credential, and throws when the credential doesn't have it as subject. `credentials.deleteById` takes a `deleteAssociatedKeys` option that deletes the holder binding of the associated credentials, including the DID records and keys of these DIDs. For a credential that wasn't received, it deletes the DIDs and keys marked for it.
