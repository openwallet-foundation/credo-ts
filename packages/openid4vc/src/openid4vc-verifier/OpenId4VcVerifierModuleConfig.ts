import type { AuthorizationEndpointConfig } from './router/authorizationEndpoint'
import type { Optional, AgentContext } from '@aries-framework/core'
import type { Router } from 'express'

import { AgentConfig } from '@aries-framework/core'
import { EventEmitter } from 'events'

import { importExpress } from '../shared/router'

import { InMemoryVerifierSessionManager, type IInMemoryVerifierSessionManager } from './InMemoryVerifierSessionManager'

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
    // FIXME: interface name with openid4vc prefix
    authorization?: Optional<AuthorizationEndpointConfig, 'endpointPath'>
  }

  // FIXME: remove
  sessionManagerFactory?: () => IInMemoryVerifierSessionManager
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions
  public readonly router: Router

  private eventEmitterMap: Map<string, EventEmitter>
  private sessionManagerMap: Map<string, IInMemoryVerifierSessionManager>

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options
    this.sessionManagerMap = new Map()
    this.eventEmitterMap = new Map()

    this.router = options.router ?? importExpress().Router()
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  public get authorizationEndpoint(): AuthorizationEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints?.authorization

    return {
      ...userOptions,
      endpointPath: userOptions?.endpointPath ?? '/authorize',
    }
  }

  public getSessionManager(agentContext: AgentContext) {
    const val = this.sessionManagerMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const logger = agentContext.dependencyManager.resolve(AgentConfig).logger

    const newVal =
      this.options.sessionManagerFactory?.() ??
      new InMemoryVerifierSessionManager(this.getEventEmitter(agentContext), logger)
    this.sessionManagerMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }

  public getEventEmitter(agentConext: AgentContext) {
    const val = this.eventEmitterMap.get(agentConext.contextCorrelationId)
    if (val) return val

    const newVal = new EventEmitter()
    this.eventEmitterMap.set(agentConext.contextCorrelationId, newVal)
    return newVal
  }
}
