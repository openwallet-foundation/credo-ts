---
"@credo-ts/core": patch
---

Normalize DID identifiers when authenticating the credential subject of a verifiable presentation. A credential subject id that references a specific verification method (e.g. `did:example:123#0`) now matches the bare DID controller (`did:example:123`), as both refer to the same DID subject. Non-DID identifiers are still compared as-is.
