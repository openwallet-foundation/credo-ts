---
'@credo-ts/node': patch
---

ECDH-ES in the node KMS now works with X25519 keys and with key wrapping, including 64 byte keys such as for `A256CBC-HS512`. P-384 and P-521 now derive keys with SHA-256 like other JOSE libraries, so data encrypted with the old node KMS on those curves won't decrypt.
