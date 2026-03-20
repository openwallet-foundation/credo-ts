import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../models'
import type { DidCommBasicMessagesModuleConfigOptions } from './DidCommBasicMessagesModuleConfig'
import { DidCommBasicMessagesModuleConfig } from './DidCommBasicMessagesModuleConfig'
import { DidCommBasicMessageRole } from './DidCommBasicMessageRole'
import { DidCommBasicMessagesApi } from './DidCommBasicMessagesApi'
import { DidCommBasicMessageHandler, DidCommBasicMessageV2Handler } from './handlers'
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
    dependencyManager.registerSingleton(DidCommBasicMessageRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(DidCommMessageHandlerRegistry)
    const basicMessageService = agentContext.resolve(DidCommBasicMessageService)

    if (this.config.supportsV1) {
      messageHandlerRegistry.registerMessageHandler(new DidCommBasicMessageHandler(basicMessageService))
      featureRegistry.register(
        new DidCommProtocol({
          id: 'https://didcomm.org/basicmessage/1.0',
          roles: [DidCommBasicMessageRole.Sender, DidCommBasicMessageRole.Receiver],
        })
      )
    }

    if (this.config.supportsV2) {
      messageHandlerRegistry.registerMessageHandler(new DidCommBasicMessageV2Handler(basicMessageService))
      featureRegistry.register(
        new DidCommProtocol({
          id: 'https://didcomm.org/basicmessage/2.0',
          roles: [DidCommBasicMessageRole.Sender, DidCommBasicMessageRole.Receiver],
        })
      )
    }
  }
}
