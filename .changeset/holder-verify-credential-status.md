---
'@credo-ts/openid4vc': patch
---

`requestCredentials` and `requestDeferredCredentials` now respect `verifyCredentialStatus` for SD-JWT VCs and W3C v2 SD-JWT credentials. Before, the status list was always fetched and checked while receiving these credentials, even with the option at its default of `false`.
