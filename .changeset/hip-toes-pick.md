---
"@credo-ts/openid4vc": patch
---

Introduces a new callback in the issuer configuration (`getChainedAuthorizationRequestParameters`),
which can be used to dynamically provide:

- The scopes to request to the chained authorization server.
- Any additional payload to add to the request to the chained authorization server.
- An allowed list of redirect URIs, if you want to limit to which wallets you're issuing to.

The following has been changed in `OpenId4VciChainedAuthorizationServerConfig`:

- The `scopesMapping` option is now optional. Either `scopesMapping` or the new callback
  must be defined in order to fullfil a chained authorization request.
- A new `redirectUris` option has been added. This can be used when you want to statically
  define the allowed `redirectUris`, instead of using the callback. If the callback is
  provided, this option will not be used.

The option `getVerificationSessionForIssuanceSessionAuthorization` has been deprecated and replaced with `getVerificationSession`. Please update your usage.
