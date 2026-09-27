---
'@credo-ts/anoncreds': patch
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/cheqd': patch
'@credo-ts/hedera': patch
'@credo-ts/webvh': patch
---

Migrate Credo's examples, tests, and documentation to the AnonCreds integration subpaths. DIDComm formats, protocols, and related types now use `@credo-ts/anoncreds/didcomm`, while Cheqd and Hedera registries use their `/anoncreds` subpaths.

The existing package-root exports remain available, so this caller migration does not require consumers to change their imports yet.
