import { AgentContext } from '@credo-ts/core'
import type { Router } from 'express'
import { importExpress } from '../shared/router'

export interface OpenId4VcVerifierModuleConfigOptions {
  /**
   * Base url at which the verifier endpoints will be hosted. All endpoints will be exposed with
   * this path as prefix.
   */
  baseUrl: string

  /**
   * Express router on which the verifier endpoints will be registered. If
   * no router is provided, a new one will be created.
   *
   * NOTE: you must manually register the router on your express app and
   * expose this on a public url that is reachable when `baseUrl` is called.
   */
  router?: Router

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

  /**
   * Configuration for the federation endpoint.
   */
  federation?: {
    // TODO: Make this functions also compatible with the issuer side
    isSubordinateEntity?: (
      agentContext: AgentContext,
      options: {
        verifierId: string

        issuerEntityId: string
        subjectEntityId: string
      }
    ) => Promise<boolean>
    getAuthorityHints?: (
      agentContext: AgentContext,
      options: {
        verifierId: string

        issuerEntityId: string
      }
    ) => Promise<string[] | undefined>
  }
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions
  public readonly router: Router

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options

    this.router = options.router ?? importExpress().Router()
  }

  public get baseUrl() {
    return this.options.baseUrl
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

  public get federation() {
    return this.options.federation
  }
}
