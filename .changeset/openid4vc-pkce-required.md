---
'@credo-ts/openid4vc': patch
---

The issuer now stores the `code_challenge` from a pushed authorization request on the issuance session, so the `code_verifier` is verified at the token endpoint. Previously the code challenge was ignored and an authorization code could be redeemed without a valid `code_verifier`.

Also adds a `pkceRequired` option to the issuer module config. When enabled, a pushed authorization request without a `code_challenge`, or with a `code_challenge_method` other than `S256`, is rejected with `invalid_request`. It defaults to `false`.

```ts
new OpenId4VcModule({
  issuer: {
    baseUrl: 'https://issuer.example.com/oid4vci',
    pkceRequired: true,
  },
})
```
