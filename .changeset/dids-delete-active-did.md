---
'@credo-ts/core': patch
'@credo-ts/cheqd': patch
'@credo-ts/webvh': patch
---

A `DidRegistrar` now has `deactivationSupport`. It is `supported` when deactivating publishes it (did:cheqd and did:hedera), `notSupportedByMethod` when the DID method has no deactivation (did:key, did:jwk and did:peer) and `notSupportedByRegistrar` when the registrar doesn't implement it (did:indy and did:webvh). `deactivate` is now optional on a `DidRegistrar`. A registrar with `notSupportedByMethod` leaves it out, and `dids.deactivate` then only marks the DID record as deactivated. `dids.deleteCreatedDid` throws for a DID that isn't deactivated, because without the record the agent can no longer deactivate it. Deactivate the DID first, or pass `deleteActiveDid: true` to delete it anyway. A DID whose method has no deactivation, such as did:key, is deleted without it.
