---
'@credo-ts/anoncreds': patch
---

fix: store the proposal and offer messages in the Issue Credential V1 protocol before emitting the state changed event, so event handlers can find them.
