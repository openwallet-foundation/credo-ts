---
'@credo-ts/anoncreds': minor
'@credo-ts/webvh': minor
---

Expose the canonical AnonCreds W3C proof APIs from `@credo-ts/anoncreds`, as established by the v0.7.x API migration. Remove the deprecated AnonCreds DIDComm formats and protocols from the package root and expose them through `@credo-ts/anoncreds/didcomm`, while keeping DIDComm as a required AnonCreds dependency. Make AnonCreds an optional peer dependency of WebVH and expose its registry only through its `/anoncreds` subpath. Consumers using that registry must install `@credo-ts/anoncreds` explicitly.
