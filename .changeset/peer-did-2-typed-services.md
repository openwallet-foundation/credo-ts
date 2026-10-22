---
'@credo-ts/core': patch
---

`didToNumAlgo2DidDocument` now creates the services of a `did:peer:2` DID document as instances of their typed service classes (`DidCommV1Service`, `IndyAgentService`, `DidCommV2Service` or `LegacyDidCommV2Service`) instead of the generic `DidDocumentService`. Before, the generic instances had no `priority`, so `DidDocument.didCommServices` sorted the services of a resolved `did:peer:2` on `undefined`, and `instanceof` checks on these services failed. The `priority` of a `did-communication` service now defaults to `0`, as it does for every other DID method.
