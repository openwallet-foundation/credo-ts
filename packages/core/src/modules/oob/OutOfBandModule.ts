import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'

import { Protocol } from '../../agent/models'

import { OutOfBandApi } from './OutOfBandApi'
import { OutOfBandService } from './OutOfBandService'
import { OutOfBandRepository } from './repository'

export class OutOfBandModule implements Module {
  public readonly api = OutOfBandApi

  /**
   * Registers the dependencies of the ot of band module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(OutOfBandApi)

    // Services
    dependencyManager.registerSingleton(OutOfBandService)

    // Repositories
    dependencyManager.registerSingleton(OutOfBandRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/out-of-band/1.1',
        roles: ['sender', 'receiver'],
      })
    )
  }
}
