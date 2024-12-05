export interface OpenId4VciAuthorizationServerConfig {
  // The base Url of your OAuth Server
  issuer: string

  /**
   * Optional client authentication for token introspection
   */
  clientAuthentication?: {
    clientId: string
    clientSecret: string
  }
}
