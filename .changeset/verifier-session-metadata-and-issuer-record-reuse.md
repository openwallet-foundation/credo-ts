---
'@credo-ts/openid4vc': patch
---

Added a `recordMetadata` option to `createAuthorizationRequest` of the OpenID4VP verifier. The entries are set on the `metadata` of the verification session record before it is stored, so the record does not have to be updated right after it is created.

```ts
await agent.openid4vc.verifier.createAuthorizationRequest({
  verifierId,
  requestSigner,
  dcql: { query },
  recordMetadata: { 'my-app/context': { templateId } },
})
```

The credential and deferred credential endpoints of the OpenID4VCI issuer no longer read the issuer record a second time, they use the one already loaded for the request.

The deferred credential endpoint now only looks up issuance sessions of the issuer the request was sent to, like the credential endpoint.
