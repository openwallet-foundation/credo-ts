---
'@credo-ts/openid4vc': minor
---

Update `@openid4vc/*` to `^0.8.0` and bind an issuance session to the wallet attestation it is started with. The first request of a session with a wallet attestation stores the thumbprint of its `cnf` key as `walletAttestation.confirmationJwkThumbprint` and its `sub` as the session `clientId`, also in the pre-authorized code flow. Every later request of the session, including refresh token requests, must then include a wallet attestation for the same key and client id, as required for refresh tokens by draft-ietf-oauth-attestation-based-client-auth section 10.3. A wallet that renews its wallet attestation must keep the same key.

As the client id is now also known in the pre-authorized code flow with a wallet attestation, the `iss` of a credential request proof must then be the client id. Only with anonymous access to the token endpoint is `iss` omitted. A wallet built on Credo must pass `clientId` to `requestCredentials` when it used a wallet attestation in the pre-authorized code flow.
