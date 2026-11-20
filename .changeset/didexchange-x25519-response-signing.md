---
'@credo-ts/didcomm': patch
---

A DID Exchange response to a public DID invitation is signed again when the DID's `did-communication` service lists an X25519 key. The response is signed with the Ed25519 key that the X25519 key was derived from, which the receiver takes as the invitation key. Without that signature the receiver rejected the response.
