---
'@credo-ts/core': patch
---

Presentation Exchange presentations now support `useMode` for each selected credential, like DCQL. They default to `CredentialMultiInstanceUseMode.NewOrFirst`, so a credential received in a batch is presented with a new instance instead of always the first one, and the use of the instance is counted. DCQL presentations of W3C v2 credentials now follow the `useMode` and count the use, like the other formats, instead of always presenting the first instance. `useInstanceFromCredentialRecord` now decodes W3C v2 Data Integrity instances.
