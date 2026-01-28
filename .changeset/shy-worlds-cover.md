---
"@credo-ts/openid4vc": patch
---

feat: add support for RFC 9207 OAuth 2.0 Authorization Server Issuer Identification, as required by HAIP/FAPI. For the Credo authorization server this is automatically handled (chained authorization). For external authorization servers this needs to be done manually. For wallets you need to parse the oid4vci authorization response using the new `agent.openid4vc.holder.parseAuthorizationCodeFromAuthorizationResponse` method.
