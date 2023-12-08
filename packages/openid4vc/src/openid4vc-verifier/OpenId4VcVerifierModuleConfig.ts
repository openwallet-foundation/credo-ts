import type { VerifierMetadata } from './OpenId4VcVerifierServiceOptions'

import { AgentConfig, type AgentContext } from '@aries-framework/core'
import { EventEmitter } from 'events'

import { InMemoryVerifierSessionManager, type IInMemoryVerifierSessionManager } from './InMemoryVerifierSessionManager'

export interface OpenId4VcVerifierModuleConfigOptions {
  verifierMetadata: VerifierMetadata
  sessionManagerFactory?: () => IInMemoryVerifierSessionManager
}

export class OpenId4VcVerifierModuleConfig {
  private options: OpenId4VcVerifierModuleConfigOptions
  private basePathMap: Map<string, string>
  private eventEmitterMap: Map<string, EventEmitter>
  private sessionManagerMap: Map<string, IInMemoryVerifierSessionManager>

  public constructor(options: OpenId4VcVerifierModuleConfigOptions) {
    this.options = options
    this.sessionManagerMap = new Map()
    this.eventEmitterMap = new Map()
    this.basePathMap = new Map()
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

  public getBasePath(agentContext: AgentContext): string {
    return this.basePathMap.get(agentContext.contextCorrelationId) ?? '/'
  }

  public setBasePath(agentContext: AgentContext, basePath: string): void {
    this.basePathMap.set(agentContext.contextCorrelationId, basePath)
  }

  public get verifierMetadata() {
    return this.options.verifierMetadata
  }
}
