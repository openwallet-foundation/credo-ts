---
'@credo-ts/openid4vc': patch
---

The verification session state change event payload now has the new `state`, and on `ResponseVerified` includes the verified response as `verifiedAuthorizationResponse`. It has the type metadata resolved during verification, so you don't need to call `getVerifiedAuthorizationResponse`, which resolves it again. Narrow on `payload.state` to get it typed.
