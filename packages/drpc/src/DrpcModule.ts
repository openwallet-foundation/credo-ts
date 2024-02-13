import type { FeatureRegistry, DependencyManager, Module } from '@credo-ts/core'

import { Protocol } from '@credo-ts/core'

import { DrpcApi } from './DrpcApi'
import { DrpcRole } from './DrpcRole'
import { DrpcMessageRepository } from './repository'
import { DrpcService } from './services'

export class DrpcModule implements Module {
  public readonly api = DrpcApi

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Services
    dependencyManager.registerSingleton(DrpcService)

    // Repositories
    dependencyManager.registerSingleton(DrpcMessageRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [DrpcRole.Sender, DrpcRole.Receiver],
      })
    )
  }
}
