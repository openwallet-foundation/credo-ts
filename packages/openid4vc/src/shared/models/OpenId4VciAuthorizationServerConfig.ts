import type { Optional } from '@credo-ts/core'

/**
 * Credo supports two types of authorization servers, indicated by the `type` field:
 *
 * - `direct` - The authorization server will be listed as part of the
 *  `authorization_servers` in the OpenID4VCI issuer metadata and clients/wallets
 *  will directly interact with the authorization server. Your authorization server
 *  must be aware of wallet-specific features, such as `issuer_state`, and, optionally,
 *  wallet attestations, DPoP, PAR, etc.
 *
 * - `chained` - The authorization server will **not** be listed as part of the
 * `authorization_servers` in the OpenID4VCI issuer metadata and clients/wallets
 *  will not directly interact with the authorization server. This allows all
 * Credo's features, such as wallet attestations, DPoP & PAR, to be used while
 * still leveraging the authentication of the external authorization server.
 */
export type OpenId4VciAuthorizationServerConfig =
  | OpenId4VciDirectAuthorizationServerConfig
  | OpenId4VciChainedAuthorizationServerConfig

/**
 * Perform authentication based on a client secret. It will dynamically use
 * `client_secret_post` or `client_secret_basic` based on the method supported
 * by the authorization server.
 */
export interface OpenId4VciAuthorizationServerClientAuthenticationClientSecret {
  /**
   * @note if no type is defined, the default is `clientSecret` due to older versions
   * of Credo not having a type
   */
  type: 'clientSecret'

  clientId: string
  clientSecret: string
}

export interface OpenId4VciDirectAuthorizationServerConfig {
  type: 'direct'

  /**
   * The `issuer` url of your OAuth server. This URL must expose well-known OAuth2 metadata
   */
  issuer: string

  /**
   * Optional client authentication for token introspection
   *
   * @note `type` is optional for client secret authentication, in this case `clientSecret` is implied
   * due to older versions of Credo not having a `type`.
   */
  clientAuthentication?: Optional<OpenId4VciAuthorizationServerClientAuthenticationClientSecret, 'type'>
}

/**
 * @note we should probably support two flows for chained authorization servers:
 *
 * - Using OpenID Connect where we receive an ID Token from the extern IDP. In this case
 * the ID Token can contain claims which we will map to claims in the credential. This way
 * you can hook it up into any existing IDP and as long as it's in an ID Token you can directly
 * issue it into a credential without the need for a glue layer.
 *
 * - Using OAuth2 (i think code grant, but maybe others?). We can convert this into an access token
 * and use that access token to call an external endpoint with either GET/POST the credential data.
 * We can then map the response to values in the credential.
 *
 * It can also be a combination. Where you retrieve an ID Token, put some of the ID token claims in the
 * credential, but then also make a request to an external resource server to fetch additional data. Especially
 * if multiple credentials are being issued this can allow for a combined approach.
 *
 * Some requirements:
 * - All of the issued credentials in one offer need to use the same authorization server. With the
 *    `authorization_server` in the credential offer this is already handled, but with chained mode
 *   all requests will use the credo authorization server. So we need to configure it on a `credential_configuration_id`
 *   level and enforce this at time of issuance.
 *
 * We would have to think how we correctly initiate the request to the external authorization server
 * to include the correct scopes etc.. We have the scopes on our end, but these may need to be mapped
 * to other scopes on their external authorizations server's end. So we probably need an additional option
 * for all credential configurations that won't be published, but configures how it's mapped. OR, and this may
 * be more flexible, we dynamically call a callback when we initiate the request to an external authorizatino
 * server. The callback approach may be more flexible, the pre-configured approach might be easier to set up.
 * Same holds for the client_id, client_secret, we could also dynamically inject these. Along with
 * even the chained authorization servers. The `direct` NEEDS to be configured in the issuer metadata
 * but that's not the case for chained.
 *
 * @note for Paradym. I think in the beginning we only want to support the chained mode. As it gives
 * way more control on our end, and means there's way less restrictions on the external authorization
 * server. If it's needed we can add the direct flow as well, but we would need to disable quite some
 * settings then as e.g. wallet attestations, DPoP, PKCE, will all be handled by the external authorization
 * server.
 */
export interface OpenId4VciChainedAuthorizationServerConfig {
  type: 'chained'

  /**
   * The `issuer` url of your OAuth server. This URL must expose well-known OAuth2 metadata
   */
  issuer: string

  /**
   * Client authentication for interacting with the external authorization server.
   *
   * This will be used for exchanging the authorization code for an access token
   */
  clientAuthentication: OpenId4VciAuthorizationServerClientAuthenticationClientSecret

  /**
   * Mapping between credential scopes and authorization server scopes.
   *
   * This is mandatory. If a scope is missing, an error will be thrown when making
   * a credential offer.
   */
  scopesMapping: Record<string, string[]>
}
