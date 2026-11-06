---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/openid4vc': patch
---

Add `supportedJwaSignatureAlgorithms` to the `KeyManagementApi`, which excludes symmetric (HMAC) algorithms unless `includeSymmetricAlgorithms` is set. OpenID4VC and DIDComm now use it, so symmetric algorithms are no longer advertised in metadata such as `vp_formats_supported`, `proof_signing_alg_values_supported` and `algsSupported`.
