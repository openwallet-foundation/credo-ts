---
'@credo-ts/didcomm': patch
---

A mediator answers `client_error` to a keylist update that adds a recipient key, or a recipient DID with Coordinate Mediation 2.0, that another mediatee already registered. Before, the key was added to the second mediation record too, so every forward for it matched two records and failed, and the first mediatee stopped receiving messages.
