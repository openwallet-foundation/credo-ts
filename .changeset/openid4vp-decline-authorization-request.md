---
'@credo-ts/openid4vc': minor
---

Add `declineOpenId4VpAuthorizationRequest` to the OpenID4VC holder. It sends an OpenID4VP Authorization Error Response to the verifier.

- The error is `access_denied` by default. Use it when the user declines or the wallet doesn't have the requested credentials.
- For `direct_post.jwt` the error is encrypted. It is sent unencrypted when encryption isn't possible.
- For the DC API the error is returned, to be passed to the platform.
- The result has the same shape as for `acceptOpenId4VpAuthorizationRequest`, including the `redirectUri` from the verifier.
- `resolveOpenId4VpAuthorizationRequest` throws an `Openid4vpAuthorizationRequestError` for an invalid request. Pass it to `declineOpenId4VpAuthorizationRequest` as `authorizationRequestError` to send the error to the verifier. When the client is not authenticated, the result has no `redirectUri`.
- `acceptOpenId4VpAuthorizationRequest` now also returns the `redirectUri` when the verifier responds with an error.

```ts
try {
  const resolved = await agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(request)
  // ... the user declines
  const { redirectUri } = await agent.openid4vc.holder.declineOpenId4VpAuthorizationRequest({
    authorizationRequestPayload: resolved.authorizationRequestPayload,
  })
} catch (error) {
  if (error instanceof Openid4vpAuthorizationRequestError) {
    // No redirectUri when the client is not authenticated
    const { redirectUri } = await agent.openid4vc.holder.declineOpenId4VpAuthorizationRequest({
      authorizationRequestError: error,
    })
  }
}
```
