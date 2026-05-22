---
"@credo-ts/core": patch
---

Add optional `deviceKeyAuthorizations` to `MdocSignOptions` to embed MSO `deviceKeyInfo.keyAuthorizations` at sign time, with validation that authorized namespaces and data elements exist in the issuance payload.
