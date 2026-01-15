---
"@credo-ts/core": patch
---

fix: improve did key id resolving. We used `startsWith` to match, but that has loopholes, and did not correctly handle all relative key ids. We now 'compact' each key id (remove the did prefix) but only if the keyId starts with the did document id, and compares them.
