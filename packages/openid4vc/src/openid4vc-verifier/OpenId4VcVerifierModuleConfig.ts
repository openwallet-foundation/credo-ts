import type { OpenId4VcSiopAuthorizationEndpointConfig } from './router/authorizationEndpoint'
import type { OpenId4VcSiopAuthorizationRequestEndpointConfig } from './router/authorizationRequestEndpoint'
import type { OpenId4VcSiopFederationEndpointConfig } from './router/federationEndpoint'
import type { Optional } from '@credo-ts/core'
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

  endpoints?: {
    authorization?: Optional<OpenId4VcSiopAuthorizationEndpointConfig, 'endpointPath'>
    authorizationRequest?: Optional<OpenId4VcSiopAuthorizationRequestEndpointConfig, 'endpointPath'>
    federation?: Optional<OpenId4VcSiopFederationEndpointConfig, 'endpointPath'>
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

  public get authorizationRequestEndpoint(): OpenId4VcSiopAuthorizationRequestEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints?.authorizationRequest

    return {
      ...userOptions,
      endpointPath: this.options.endpoints?.authorizationRequest?.endpointPath ?? '/authorization-requests',
    }
  }

  public get authorizationEndpoint(): OpenId4VcSiopAuthorizationEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints?.authorization

    return {
      ...userOptions,
      endpointPath: userOptions?.endpointPath ?? '/authorize',
    }
  }

  public get federationEndpoint(): OpenId4VcSiopFederationEndpointConfig | undefined {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints?.federation
    if (!userOptions) return undefined

    return {
      ...userOptions,
      endpointPath: userOptions.endpointPath ?? '/.well-known/openid-federation',
    }
  }
}
