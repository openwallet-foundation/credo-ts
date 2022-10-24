import type { DependencyManager, FeatureRegistry, Module } from '@aries-framework/core'

import { Protocol } from '@aries-framework/core'

import { DummyApi } from './DummyApi'
import { DummyRepository } from './repository'
import { DummyService } from './services'

export class DummyModule implements Module {
  public api = DummyApi

  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(DummyApi)

    dependencyManager.registerSingleton(DummyRepository)
    dependencyManager.registerSingleton(DummyService)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/dummy/1.0',
        roles: ['requester', 'responder'],
      })
    )
  }
}
