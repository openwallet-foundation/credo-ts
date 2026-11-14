---
'@credo-ts/openid4vc': patch
---

Added a `verifiedAuthorizationResponseHandler` option to the OpenID4VP verifier module config.

- Called and awaited after the response is verified, before the session is updated and the wallet gets its response.
- Use it for extra processing or verification before the presentation counts as verified.
- When it throws, the session moves to `Error` and the wallet gets a `500` `server_error` response. Throw an `Oauth2ServerErrorResponseError` to choose the response.
- It holds the request of the wallet, and no timeout is applied.

```ts
new OpenId4VcModule({
  verifier: {
    baseUrl,
    verifiedAuthorizationResponseHandler: async ({ verificationSession, verifiedAuthorizationResponse }) => {
      const allowed = await isPresentationAllowed(verificationSession.id, verifiedAuthorizationResponse.dcql)
      if (!allowed) {
        throw new Oauth2ServerErrorResponseError(
          { error: Oauth2ErrorCodes.AccessDenied, error_description: 'Presentation rejected' },
          { status: 403 }
        )
      }
    },
  },
})
```
