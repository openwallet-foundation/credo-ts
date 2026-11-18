---
"@credo-ts/core": patch
---

All W3C presentation formats now handle a `credentialSubject.id` that is a DID URL (e.g. `did:jwk:...#0`) the same way: VCDM 1.1 JWT and JSON-LD, and VCDM 2.0 JWT, SD-JWT and Data Integrity. Such an id counts as its DID, but the presentation must be signed with the verification method it names. A credential issued to `#key-1` is no longer accepted in a presentation signed with `#key-2`, which VCDM 1.1 accepted before. VCDM 2.0 credentials with such an id can now be presented, as signing and verifying compared the exact id before. DCQL and DIF Presentation Exchange now sign with the key the id names and set the bare DID as `holder`.

`toAbsoluteDidUrl` is a new export that resolves a relative DID URL such as `#key-1` against a DID.
