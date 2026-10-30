---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

W3C v2 SD-JWT presentations created by `W3cV2SdJwtCredentialService` now include `iat`, and the ones created by the `DcqlService` include the `undefined-terms/v2` context. W3C v2 SD-JWT credentials can no longer make `issuer`, `validFrom` or `validUntil` selectively disclosable, so an issuer disclosure frame that does now throws. The OpenID4VP holder rejects authorization requests whose `client_id` starts with `didcomm:`.
