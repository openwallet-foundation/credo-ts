---
"@credo-ts/openid4vc": minor
---

Introduces a new callback in the issuer configuration (`getChainedAuthorizationOptionsForIssuanceSessionAuthorization`), which can be used
to dynamically provide the request scopes and additional payload to the chained authorization server that is being used with the request.

This means that the `scopesMapping` configuration is now optional. Either `scopesMapping` ot the new callback must be defined in order to fullfil
a chained authorization request.
