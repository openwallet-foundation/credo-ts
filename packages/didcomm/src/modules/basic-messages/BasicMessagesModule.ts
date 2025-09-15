import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { FeatureRegistry } from '../../FeatureRegistry'
import { Protocol } from '../../models'

import { MessageHandlerRegistry } from '../../MessageHandlerRegistry'
import { BasicMessageRole } from './BasicMessageRole'
import { BasicMessagesApi } from './BasicMessagesApi'
import { BasicMessageHandler } from './handlers'
import { BasicMessageRepository } from './repository'
import { BasicMessageService } from './services'

export class BasicMessagesModule implements Module {
  public readonly api = BasicMessagesApi

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(BasicMessageService)

    // Repositories
    dependencyManager.registerSingleton(BasicMessageRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.resolve(FeatureRegistry)
    const messageHandlerRegistry = agentContext.resolve(MessageHandlerRegistry)
    const basicMessageService = agentContext.resolve(BasicMessageService)

    messageHandlerRegistry.registerMessageHandler(new BasicMessageHandler(basicMessageService))

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/basicmessage/1.0',
        roles: [BasicMessageRole.Sender, BasicMessageRole.Receiver],
      })
    )
  }
}
