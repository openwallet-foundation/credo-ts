---
"@credo-ts/core": patch
---

All W3C presentation formats now handle a `credentialSubject.id` that is a DID URL (e.g. `did:jwk:...#0`) the same way: VCDM 1.1 JWT and JSON-LD, and VCDM 2.0 JWT, SD-JWT and Data Integrity. Such an id counts as its DID, but the presentation must be signed with the verification method it names. A credential issued to `#key-1` is no longer accepted in a presentation signed with `#key-2`, which VCDM 1.1 accepted before. VCDM 2.0 credentials with such an id can now be presented, as signing and verifying compared the exact id before. DCQL and DIF Presentation Exchange now sign with the key the id names and set the bare DID as `holder`.

A credential whose `credentialSubject.id` names a key can only be presented with that key, so not once the key is rotated out of the DID document, or if it isn't an `authentication` method. A `credentialSubject.id` with a path, a query (such as `versionId`) or an empty fragment does not authenticate the holder, when signing or verifying, as the credential subject is always authenticated against the current DID document. VCDM 1.1 treated such an id as its DID before.

`toAbsoluteDidUrl` is a new export that resolves a fragment-only relative DID URL such as `#key-1` against a DID. It returns any other value unchanged, so it never produces an invalid DID URL.
