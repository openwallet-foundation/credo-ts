---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

`JweService.decryptJwe` rejects a JWE whose `epk` has a different key type or curve than the recipient public key before calling the KMS. A failed JWE decryption in OpenID4VC is logged as a warning instead of an error, as it is mostly caused by the sender.
