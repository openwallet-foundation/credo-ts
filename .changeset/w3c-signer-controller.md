---
'@credo-ts/core': patch
---

Verifying a W3C credential or presentation (JWT, SD-JWT, Data Integrity and JSON-LD) now rejects a signing key whose controller is not the DID of the document it is listed in. Before, a DID document could name another DID as the controller of its keys, and a Data Integrity credential or presentation, or a JWT presentation without `iss`, was then attributed to that DID.
