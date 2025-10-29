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
