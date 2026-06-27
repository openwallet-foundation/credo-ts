---
"@credo-ts/openid4vc": minor
---

feat(openid4vc): add a `getDynamicIssuanceSession` callback for dynamic (wallet-initiated) issuance that is not bound to a credential offer.

The callback is the single decision point and application-level abuse-prevention gate for dynamic issuance. It is invoked when:

- a Pushed Authorization Request or Authorization Challenge request is received by the internal authorization server without an `issuer_state` (the `chained` and `presentation` flows), or
- the credential endpoint receives an access token issued by an external authorization server that is not bound to a credential offer (the `external` flow).

The callback input is typed based on the endpoint that received the request (discriminated by `origin`: `pushedAuthorizationRequest`, `authorizationChallengeRequest`, or `credentialRequest`). For the authorization-server origins the parsed (not yet verified) wallet attestation, DPoP and raw request are available; for the credential-request origin the verified access token payload is available.

The callback returns options describing the issuance session to create (or throws / returns `undefined` to deny). The returned options are typed based on the chosen `authorizationFlow`:

- `chained` - authorization is delegated to a chained (internal) authorization server.
- `presentation` - authorization is completed using an OpenID4VP presentation during issuance (requires `getVerificationSession`).
- `external` - authorization has already been completed at an external authorization server (DPoP/wallet attestation requirements and refresh tokens are not configurable, as these are handled by the external authorization server).

This enables wallet-initiated issuance for the chained authorization server and presentation during issuance flows, and unifies the existing external authorization server dynamic issuance under the same callback.

The `allowDynamicIssuanceSessions` configuration option is deprecated, and the `getDynamicIssuanceSession` callback takes precedence.