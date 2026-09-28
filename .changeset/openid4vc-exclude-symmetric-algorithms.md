---
'@credo-ts/openid4vc': patch
---

Do not advertise symmetric (HMAC) signature algorithms in OpenID4VC metadata, such as `vp_formats_supported` and `proof_signing_alg_values_supported`, even if the KMS supports them.
