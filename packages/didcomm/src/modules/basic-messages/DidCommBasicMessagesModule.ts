import type { AgentContext, DependencyManager, Module } from '@credo-ts/core'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommBasicMessageRole } from './DidCommBasicMessageRole'
import { DidCommBasicMessagesApi } from './DidCommBasicMessagesApi'
import { DidCommBasicMessageRepository } from './repository'
import { DidCommBasicMessageService } from './services'

export class DidCommBasicMessagesModule implements Module {
  public readonly api = DidCommBasicMessagesApi

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(DidCommBasicMessageService)

    // Repositories
    dependencyManager.registerSingleton(DidCommBasicMessageRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/basicmessage/1.0',
        roles: [DidCommBasicMessageRole.Sender, DidCommBasicMessageRole.Receiver],
      })
    )
  }
}
