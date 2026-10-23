---
'@credo-ts/openid4vc': minor
---

Add `declineOpenId4VpAuthorizationRequest` to the OpenID4VC holder. It sends an OpenID4VP Authorization Error Response (OpenID4VP 1.0 Section 8.5), `access_denied` by default, which covers both a user that declines and a wallet that doesn't have the requested credentials. For `direct_post.jwt` the error is encrypted, and sent unencrypted when it can't be encrypted (Section 8.3.1). For the DC API the error is returned to be passed to the platform. The result has the same shape as `acceptOpenId4VpAuthorizationRequest`, including the `redirectUri` the verifier may return to send the user back.

`resolveOpenId4VpAuthorizationRequest` now throws an `Openid4vpAuthorizationRequestError` (exported from `@credo-ts/openid4vc`) when the request is invalid and its payload is known. This includes invalid transaction data, an invalid presentation definition or DCQL query, an unsupported client id prefix, a request object with an invalid signature, and `vp_formats_not_supported` when none of the formats in the DCQL query can be presented. Pass it to `declineOpenId4VpAuthorizationRequest` as `authorizationRequestError` to send the error to the verifier. When its `isClientAuthenticated` is `false`, the result has no `redirectUri`, as the redirect could send the user anywhere in the name of any verifier.

`acceptOpenId4VpAuthorizationRequest` now also returns the `redirectUri` when the verifier responds with an error.

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
