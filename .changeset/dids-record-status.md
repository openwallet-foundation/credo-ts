---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/cheqd': patch
'@credo-ts/webvh': patch
---

A `DidRecord` now has a `status`, `active` or `deactivated`, also stored as a tag. Deactivating a DID sets the status of its created DID record to `deactivated`. Updating a deactivated DID fails. The registrar does both, so a custom `DidRegistrar` should too. did:key, did:jwk and did:peer are not published anywhere, so deactivating them now succeeds and only changes the DID record. Records stored before this change have no status and are active. Query with `$not: { status: 'deactivated' }` to find active DIDs, because with Askar their records have no `status` tag.

The agent no longer uses a deactivated DID it created. Signing, DIDComm encryption and decryption, accepting an implicit invitation and registering AnonCreds objects with it throw a `DidDeactivatedError`. Resolving it from the DID record sets `deactivated: true` in the DID document metadata. Use `agent.dids.getActiveCreatedDid(did)` to get the record of a created DID that is still active.
