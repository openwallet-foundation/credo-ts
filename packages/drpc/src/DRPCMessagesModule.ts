import type { FeatureRegistry, DependencyManager, Module } from '@credo-ts/core'

import { Protocol } from '@credo-ts/core'

import { DRPCMessageRole } from './DRPCMessageRole'
import { DRPCMessagesApi } from './DRPCMessagesApi'
import { DRPCMessageRepository } from './repository'
import { DRPCMessageService } from './services'

export class DRPCMessagesModule implements Module {
  public readonly api = DRPCMessagesApi

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Services
    dependencyManager.registerSingleton(DRPCMessageService)

    // Repositories
    dependencyManager.registerSingleton(DRPCMessageRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [DRPCMessageRole.Sender, DRPCMessageRole.Receiver],
      })
    )
  }
}
