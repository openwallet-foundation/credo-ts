---
"@credo-ts/core": patch
---

Add optional `deviceKeyAuthorizations` to `MdocSignOptions` to embed MSO `deviceKeyInfo.keyAuthorizations` at sign time. Authorizations may include namespaces and elements not present in the issuer-signed payload. Enforce allowed namespaces and data elements when holders create and verifiers validate device responses.
