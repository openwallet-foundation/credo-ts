---
'@credo-ts/didcomm': patch
'@credo-ts/core': patch
---

Fix JSON-LD credential exchanges failing or silently stalling when the issuer's signature suite adds its own `@context` to the credential.

A signature suite must add its `@context` to the document it signs when the document does not already carry a compatible one. The holder compared the received credential to the credential request for exact equality, so this required addition was treated as a mismatch. In practice this affected `Ed25519Signature2020`, whose terms are not defined by the `credentials/v1` context, and it was not limited to a hard failure: the same check backs `shouldAutoRespondToCredential`, so with `AutoAcceptCredential.ContentApproved` the exchange stalled without an error.

The holder now also accepts the requested credential with the agreed proof type's suite context appended. Any other difference is still rejected.
