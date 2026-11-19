---
'@credo-ts/core': minor
---

Used credential instances stay on the record. `useInstanceFromCredentialRecord` no longer removes the instance it uses. It increases the instance's `usageCount` instead, so `credentialInstances.length` no longer tells how many instances are left. Use `canUseInstanceFromCredentialRecord` with `CredentialMultiInstanceUseMode.New` to check whether an unused instance is left. Every use now updates the record, also when an instance is reused, unless `updateMode` is `None`.

Only DCQL presentations and mdoc responses through the Digital Credentials API count uses. Presentation Exchange, AnonCreds proofs from W3C records and DCQL presentations of W3C v2 credentials use the first instance without counting it or marking it as used.
