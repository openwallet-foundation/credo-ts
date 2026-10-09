---
'@credo-ts/core': patch
---

SD-JWT DID resolution now selects verification methods from an explicitly supplied set of DID purposes. Signing requires an explicitly mapped local key whose public JWK matches the resolved DID verification method. Legacy key IDs remain supported when mapped in a created-DID record.
