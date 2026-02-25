import type { Express } from 'express'

export interface InternalOpenId4VcVerifierModuleConfigOptions {
  /**
   * Base url at which the verifier endpoints will be hosted. All endpoints will be exposed with
   * this path as prefix.
   */
  baseUrl: string

  /**
   * Express app on which the openid4vp endpoints will be registered.
   */
  app: Express

  /**
   * The number of seconds after which a created authorization request will expire.
   *
   * This is used for the `exp` field of a signed authorization request.
   *
   * @default 300
   */
  authorizationRequestExpirationInSeconds?: number

  endpoints?: {
    /**
     * @default /authorize
     */
    authorization?: string

    /**
     * @default /authorization-requests
     */
    authorizationRequest?: string
  }
}

export class OpenId4VcVerifierModuleConfig {
  private options: InternalOpenId4VcVerifierModuleConfigOptions

  public constructor(options: InternalOpenId4VcVerifierModuleConfigOptions) {
    this.options = options
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  public get app() {
    return this.options.app
  }

  /**
   * @default /authorize
   */
  public get authorizationRequestEndpoint(): string {
    return this.options.endpoints?.authorizationRequest ?? '/authorization-requests'
  }

  /**
   * @default /authorize
   */
  public get authorizationEndpoint(): string {
    return this.options.endpoints?.authorization ?? '/authorize'
  }

  /**
   * Time in seconds after which an authorization request will expire
   *
   * @default 300
   */
  public get authorizationRequestExpiresInSeconds() {
    return this.options.authorizationRequestExpirationInSeconds ?? 300
  }
}
