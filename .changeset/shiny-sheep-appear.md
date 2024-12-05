---
'@credo-ts/openid4vc': minor
---

feat(openid4vc): oid4vci authorization code flow, presentation during issuance and batch issuance.

This is a big change to OpenID4VCI in Credo, with the neccsary breaking changes since we first added it to the framework. Over time the spec has changed significantly, but also our understanding of the standards and protocols.

**Authorization Code Flow**
Credo now supports the authorization code flow, for both issuer and holder. An issuer can configure multiple authorization servers, and work with external authorization servers as well. The integration is based on OAuth2, with several extension specifications, mainly the OAuth2 JWT Access Token Profile, as well as Token Introspection (for opaque access tokens). Verification works out of the box, as longs as the authorization server has a `jwks_uri` configured. For Token Introspection it's also required to provide a `clientId` and `clientSecret` in the authorization server config.

To use an external authorization server, the authorization server MUST include the `issuer_state` parameter from the credential offer in the access token. Otherwise it's not possible for Credo to correlate the authorization session to the offer session.

The demo-openid contains an example with external authorization server, which can be used as reference. The Credo authorization server supports DPoP and PKCE.

**Batch Issuance**
The credential request to credential mapper has been updated to support multiple proofs, and also multiple credential instances. The client can now also handle batch issuance.

**Presentation During Issuance**
The presenation during issuance allows to request presentation using OID4VP before granting authorization for issuance of one or more credentials. This flow is automatically handled by the `resolveAuthorizationRequest` method on the oid4vci holder service.
