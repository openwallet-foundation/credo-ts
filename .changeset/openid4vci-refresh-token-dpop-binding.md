---
'@credo-ts/openid4vc': patch
---

The issuer now requires a DPoP proof for the same key when a DPoP-bound refresh token is used. Before, a refresh request without a DPoP proof was accepted when the issuance session didn't require DPoP, and returned an access token that was not bound to a key. This was the case in the pre-authorized code flow unless DPoP was required in the config or the credential offer. `OpenId4VcIssuerService.verifyRefreshToken` no longer takes a `dpop` option, as the DPoP proof is verified with the token request.
