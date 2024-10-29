export interface OpenId4VciAuthorizationServerConfig {
  // The base Url of your OAuth Server
  issuer: string

  serverType: 'oidc' | 'oauth2'

  // client id and client secret are needed when introspection is performed
  clientId?: string
  clientSecret?: string
}
