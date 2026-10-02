---
'@credo-ts/openid4vc': patch
---

Bind the wallet's PKCE `code_challenge` from a pushed authorization request (chained authorization server flow) to the issuance session, so the `code_verifier` is verified at the token endpoint. Previously the code challenge was ignored, and with `@openid4vc/oauth2` 0.6 the access token request was rejected with `Unexpected 'code_verifier' in access token request, no code challenge is bound to the grant`. A pushed authorization request with an unsupported `code_challenge_method` is now rejected with `invalid_request`.

`@openid4vc/*` dependencies are updated to `0.6.1`.
