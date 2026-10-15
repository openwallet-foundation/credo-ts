---
'@credo-ts/core': patch
---

SD-JWT DID resolution now selects verification methods from an explicitly supplied set of DID purposes. Signing requires a local key whose public JWK matches the resolved DID verification method. Legacy key IDs remain supported when the matching key exists in the KMS, even without an explicit verification-method mapping in the created-DID record.
