---
'@credo-ts/openid4vc': patch
---

Add an `allowedClockSkewInSeconds` option to the OpenID4VC issuer module config (default `0`, keeping the current behaviour). It allows a wallet's clock to be slightly ahead or behind the issuer's when verifying the `nbf` and `exp` claims of the wallet (client) attestation and Client Attestation PoP JWTs at the pushed authorization request, authorization challenge and token endpoints. Previously a wallet whose clock was a few seconds ahead was rejected with `jwt 'nbf' is in the future`. The value is also passed as the allowed clock skew for DPoP proof verification.

```ts
new OpenId4VcModule({
  issuer: {
    baseUrl: 'https://issuer.example.com/oid4vci',
    allowedClockSkewInSeconds: 5,
    // ...
  },
})
```
