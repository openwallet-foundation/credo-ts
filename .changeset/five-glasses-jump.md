---
"@credo-ts/core": minor
---

When signing with dids in Credo, it is now required that all DIDs have an associated `DidRecord` with the created role. With the new KMS API we now need to keep track of key ids for keys within a did document, and these are stored on the did document. You can import a did using `agent.dids.import` and provide the `keys` array to define the mapping between verification method and key id. If a verification method mapping to key id is not provided in the did record, we will assume the legacy key id format is used (the base58 encoded public key)
