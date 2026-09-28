---
'@credo-ts/openid4vc': patch
---

The OpenID4VCI issuer now verifies PKCE in the authorization code flow. Previously the `code_challenge` from a pushed authorization request or authorization challenge request was never stored, so the `code_verifier` was never checked at the token endpoint. Only the `S256` code challenge method is supported (as advertised in the authorization server metadata).

A new `pkceRequired` option has been added to the issuer module config. When enabled, authorization requests without a `code_challenge` are rejected with `invalid_request`, as required by FAPI 2.0, HAIP and OAuth 2.1. It defaults to `false` for now, and will default to `true` in Credo 0.8.0

```ts
new OpenId4VcModule({
  issuer: {
    baseUrl: 'https://issuer.example.com',
    pkceRequired: true,
    // ...
  },
})
```

The global value can be overridden per issuance session, using `authorization.requirePkce` when creating a credential offer, or `requirePkce` in the options returned from the `getDynamicIssuanceSession` callback.

The holder now also returns the `codeVerifier` when the authorization flow is `PresentationDuringIssuance`. It must be passed to `requestToken` together with the authorization code obtained through `retrieveAuthorizationCodeUsingPresentation`.
