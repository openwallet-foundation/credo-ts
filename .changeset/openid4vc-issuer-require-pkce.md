---
'@credo-ts/openid4vc': patch
---

The OpenID4VCI issuer now verifies PKCE in the authorization code flow. Previously the `code_challenge` from a pushed authorization request or authorization challenge request was never stored, so the `code_verifier` was never checked at the token endpoint. Only the `S256` code challenge method is supported (as advertised in the authorization server metadata).

A token request that contains a `code_verifier` while no `code_challenge` was bound to the authorization request is now rejected with `invalid_grant`, instead of ignoring the `code_verifier` and issuing the access token. This is required by RFC 9700 (OAuth 2.0 Security Best Current Practice) sections 2.1.1 and 4.8.2: without this check an authorization code obtained without PKCE can be injected into the flow of an honest client that does use PKCE.

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

With the default of `false` an authorization request without a `code_challenge` is still accepted, and the resulting authorization code can be redeemed without a `code_verifier`. Deployments that follow FAPI 2.0 or HAIP should set `pkceRequired: true`. Clients that do provide a `code_challenge` are always held to it, regardless of this option.

The global value can be overridden per issuance session, using `authorization.requirePkce` when creating a credential offer, or `requirePkce` in the options returned from the `getDynamicIssuanceSession` callback. Note that, unlike `requireDpop` and `requireWalletAttestation`, an explicit `requirePkce: false` on an issuance session disables the requirement even when `pkceRequired: true` is set globally (`requireDpop: false` and `requireWalletAttestation: false` fall back to the global value). Leave `requirePkce` undefined unless you intend to exempt a specific issuance session from a global PKCE requirement.

The holder now also returns the `codeVerifier` when the authorization flow is `PresentationDuringIssuance`. It must be passed to `requestToken` together with the authorization code obtained through `retrieveAuthorizationCodeUsingPresentation`.
