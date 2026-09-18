import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommModuleConfig } from '../../DidCommModuleConfig'
import { DidCommBasicMessagesApi } from './DidCommBasicMessagesApi'
import type { DidCommBasicMessagesModuleConfigOptions } from './DidCommBasicMessagesModuleConfig'
import { DidCommBasicMessagesModuleConfig } from './DidCommBasicMessagesModuleConfig'
import { DidCommBasicMessageV2Service } from './protocol/v2'
import { DidCommBasicMessageRepository } from './repository'
import { DidCommBasicMessageService } from './services'

export class DidCommBasicMessagesModule implements Module {
  public readonly config: DidCommBasicMessagesModuleConfig
  public readonly api = DidCommBasicMessagesApi

  public constructor(config?: DidCommBasicMessagesModuleConfigOptions) {
    this.config = new DidCommBasicMessagesModuleConfig(config)
  }

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerInstance(DidCommBasicMessagesModuleConfig, this.config)
    dependencyManager.registerSingleton(DidCommBasicMessageService)
    dependencyManager.registerSingleton(DidCommBasicMessageV2Service)
    dependencyManager.registerSingleton(DidCommBasicMessageRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const didcommVersions = agentContext.resolve(DidCommModuleConfig).didcommVersions

    const services = [
      agentContext.resolve(DidCommBasicMessageService),
      agentContext.resolve(DidCommBasicMessageV2Service),
    ] as const

    for (const service of services) {
      if (this.config.protocols.includes(service.version) && didcommVersions.includes(service.version)) {
        service.register(messageHandlerRegistry, featureRegistry)
      }
    }
  }
}
