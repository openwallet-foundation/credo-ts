---
'@credo-ts/didcomm': patch
---

A mediator answers `client_error` to a keylist update that adds a recipient key, or a recipient DID with Coordinate Mediation 2.0, that another mediatee already registered in either index: a v1 client registers the key and a v2 client registers its did:key, and both are checked. A v1 forward whose recipient is held by two mediation records is refused. Before, the key was added to the second mediation record too, so the first mediatee stopped receiving messages or had them delivered to the second one.
