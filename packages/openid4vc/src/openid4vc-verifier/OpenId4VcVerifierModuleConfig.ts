import type { OpenId4VcSiopAuthorizationEndpointConfig } from './router/authorizationEndpoint'
import type { Optional, AgentContext, AgentDependencies } from '@credo-ts/core'
import type { IRPSessionManager } from '@sphereon/did-auth-siop'
import type { Router } from 'express'

import { InMemoryRPSessionManager } from '@sphereon/did-auth-siop'

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
  }
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions
  public readonly router: Router

  private eventEmitterMap: Map<string, InstanceType<AgentDependencies['EventEmitterClass']>>
  private sessionManagerMap: Map<string, IRPSessionManager>

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options
    this.sessionManagerMap = new Map()
    this.eventEmitterMap = new Map()

    this.router = options.router ?? importExpress().Router()
  }

  public get baseUrl() {
    return this.options.baseUrl
  }

  public get authorizationEndpoint(): OpenId4VcSiopAuthorizationEndpointConfig {
    // Use user supplied options, or return defaults.
    const userOptions = this.options.endpoints?.authorization

    return {
      ...userOptions,
      endpointPath: userOptions?.endpointPath ?? '/authorize',
    }
  }

  // FIXME: rework (no in-memory)
  public getSessionManager(agentContext: AgentContext) {
    const val = this.sessionManagerMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const eventEmitter = this.getEventEmitter(agentContext)

    const newVal = new InMemoryRPSessionManager(eventEmitter)
    this.sessionManagerMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }

  // FIXME: rework (no-memory)
  public getEventEmitter(agentContext: AgentContext) {
    const EventEmitterClass = agentContext.config.agentDependencies.EventEmitterClass

    const val = this.eventEmitterMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const newVal = new EventEmitterClass()
    this.eventEmitterMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }
}
