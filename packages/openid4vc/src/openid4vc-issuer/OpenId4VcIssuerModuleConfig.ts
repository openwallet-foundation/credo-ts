import type {
  OpenId4VciAccessTokenEndpointConfig,
  OpenId4VciCredentialEndpointConfig,
  OpenId4VciCredentialOfferEndpointConfig,
} from './router'
import type { Optional } from '@credo-ts/core'
import type { Router } from 'express'

import { importExpress } from '../shared/router'

const DEFAULT_C_NONCE_EXPIRES_IN = 5 * 60 // 5 minutes
const DEFAULT_TOKEN_EXPIRES_IN = 3 * 60 // 3 minutes
const DEFAULT_PRE_AUTH_CODE_EXPIRES_IN = 3 * 60 // 3 minutes

export interface OpenId4VcIssuerModuleConfigOptions {
  /**
   * Base url at which the issuer endpoints will be hosted. All endpoints will be exposed with
   * this path as prefix.
   */
  baseUrl: string

  /**
   * Express router on which the openid4vci endpoints will be registered. If
   * no router is provided, a new one will be created.
   *
   * NOTE: you must manually register the router on your express app and
   * expose this on a public url that is reachable when `baseUrl` is called.
   */
  router?: Router

  endpoints: {
    credentialOffer?: Optional<OpenId4VciCredentialOfferEndpointConfig, 'endpointPath'>
    credential: Optional<OpenId4VciCredentialEndpointConfig, 'endpointPath'>
    accessToken?: Optional<
      OpenId4VciAccessTokenEndpointConfig,
      'cNonceExpiresInSeconds' | 'endpointPath' | 'preAuthorizedCodeExpirationInSeconds' | 'tokenExpiresInSeconds'
    >
  }
}

export class OpenId4VcIssuerModuleConfig {
  private options: OpenId4VcIssuerModuleConfigOptions
  public readonly router: Router

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.options = options

    this.router = options.router ?? importExpress().Router()
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  /**
   * Get the credential endpoint config, with default values set
   */
  public get credentialEndpoint(): OpenId4VciCredentialEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints.credential

    return {
      ...userOptions,
      endpointPath: userOptions.endpointPath ?? '/credential',
    }
  }

  /**
   * Get the access token endpoint config, with default values set
   */
  public get accessTokenEndpoint(): OpenId4VciAccessTokenEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints.accessToken ?? {}

    return {
      ...userOptions,
      endpointPath: userOptions.endpointPath ?? '/token',
      cNonceExpiresInSeconds: userOptions.cNonceExpiresInSeconds ?? DEFAULT_C_NONCE_EXPIRES_IN,
      preAuthorizedCodeExpirationInSeconds:
        userOptions.preAuthorizedCodeExpirationInSeconds ?? DEFAULT_PRE_AUTH_CODE_EXPIRES_IN,
      tokenExpiresInSeconds: userOptions.tokenExpiresInSeconds ?? DEFAULT_TOKEN_EXPIRES_IN,
    }
  }

  /**
   * Get the hosted credential offer endpoint config, with default values set
   */
  public get credentialOfferEndpoint(): OpenId4VciCredentialOfferEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints.credentialOffer ?? {}

    return {
      ...userOptions,
      endpointPath: userOptions.endpointPath ?? '/offers',
    }
  }
}
