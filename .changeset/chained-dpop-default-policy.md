---
"@credo-ts/openid4vc": patch
---

The DPoP policy towards a chained authorization server can now be set per issuance session. Return `dpopPolicy` from the `getChainedAuthorizationRequestParameters` callback to override `dpop.policy` of the authorization server config. The authorization request decides whether a session uses DPoP, and later requests to the authorization server follow that decision. A session that started without DPoP no longer fails when the server advertises DPoP support afterwards.

```ts
new OpenId4VcModule({
  issuer: {
    getChainedAuthorizationRequestParameters: async () => ({
      scopes: ['UniversityDegreeCredential'],
      dpopPolicy: 'disallowed',
    }),
  },
})
```
