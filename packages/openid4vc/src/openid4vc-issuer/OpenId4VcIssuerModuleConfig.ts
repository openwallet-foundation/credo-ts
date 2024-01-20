import type { AccessTokenEndpointConfig, CredentialEndpointConfig } from './router'
import type { AgentContext, Optional } from '@aries-framework/core'
import type { CNonceState, CredentialOfferSession, IStateManager, StateType, URIState } from '@sphereon/oid4vci-common'
import type { Router } from 'express'

import { MemoryStates } from '@sphereon/oid4vci-issuer'

import { importExpress } from '../shared/router'

export type StateManagerFactory<T extends StateType> = () => IStateManager<T>

const DEFAULT_C_NONCE_EXPIRES_IN = 5 * 60 * 1000 // 5 minutes
const DEFAULT_TOKEN_EXPIRES_IN = 3 * 60 * 1000 // 3 minutes
const DEFAULT_PRE_AUTH_CODE_EXPIRES_IN = 3 * 60 * 1000 // 3 minutes

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
    // metadata endpoint does not have a config
    // metadata?: MetadataEndpointConfig
    credential: Optional<CredentialEndpointConfig, 'endpointPath'>
    accessToken?: Optional<
      AccessTokenEndpointConfig,
      'cNonceExpiresInSeconds' | 'endpointPath' | 'preAuthorizedCodeExpirationInSeconds' | 'tokenExpiresInSeconds'
    >
  }

  // FIXME: remove
  cNonceStateManagerFactory?: StateManagerFactory<CNonceState>
  credentialOfferSessionManagerFactory?: StateManagerFactory<CredentialOfferSession>
  uriStateManagerFactory?: StateManagerFactory<URIState>
}

export class OpenId4VcIssuerModuleConfig {
  private options: OpenId4VcIssuerModuleConfigOptions
  public readonly router: Router

  // FIXME: remove
  private credentialOfferSessionManagerMap: Map<string, IStateManager<CredentialOfferSession>>
  private uriStateManagerMap: Map<string, IStateManager<URIState>>
  private cNonceStateManagerMap: Map<string, IStateManager<CNonceState>>

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.uriStateManagerMap = new Map()
    this.credentialOfferSessionManagerMap = new Map()
    this.cNonceStateManagerMap = new Map()
    this.options = options

    this.router = options.router ?? importExpress().Router()
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  /**
   * Get the credential endpoint config, with default values set
   */
  public get credentialEndpoint(): CredentialEndpointConfig {
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
  public get accessTokenEndpoint(): AccessTokenEndpointConfig {
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

  public getUriStateManager(agentContext: AgentContext) {
    const value = this.uriStateManagerMap.get(agentContext.contextCorrelationId)
    if (value) return value

    const newValue = this.options.uriStateManagerFactory?.() ?? new MemoryStates<URIState>()
    this.uriStateManagerMap.set(agentContext.contextCorrelationId, newValue)
    return newValue
  }

  public getCredentialOfferSessionStateManager(agentContext: AgentContext) {
    const value = this.credentialOfferSessionManagerMap.get(agentContext.contextCorrelationId)
    if (value) return value

    const newValue = this.options.credentialOfferSessionManagerFactory?.() ?? new MemoryStates<CredentialOfferSession>()
    this.credentialOfferSessionManagerMap.set(agentContext.contextCorrelationId, newValue)
    return newValue
  }

  public getCNonceStateManager(agentContext: AgentContext) {
    const value = this.cNonceStateManagerMap.get(agentContext.contextCorrelationId)
    if (value) return value

    const newValue = this.options.cNonceStateManagerFactory?.() ?? new MemoryStates<CNonceState>()
    this.cNonceStateManagerMap.set(agentContext.contextCorrelationId, newValue)
    return newValue
  }
}
