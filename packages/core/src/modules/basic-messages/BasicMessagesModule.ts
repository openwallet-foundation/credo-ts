import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'

import { Protocol } from '../../agent/models'

import { BasicMessageRole } from './BasicMessageRole'
import { BasicMessagesApi } from './BasicMessagesApi'
import { BasicMessageRepository } from './repository'
import { BasicMessageService } from './services'

export class BasicMessagesModule implements Module {
  public readonly api = BasicMessagesApi

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(BasicMessagesApi)

    // Services
    dependencyManager.registerSingleton(BasicMessageService)

    // Repositories
    dependencyManager.registerSingleton(BasicMessageRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/basicmessage/1.0',
        roles: [BasicMessageRole.Sender, BasicMessageRole.Receiver],
      })
    )
  }
}
