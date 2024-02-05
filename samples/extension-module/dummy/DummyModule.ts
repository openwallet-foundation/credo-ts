import type { DummyModuleConfigOptions } from './DummyModuleConfig'
import type { DependencyManager, FeatureRegistry, Module } from '@credo-ts/core'

import { Protocol } from '@credo-ts/core'

import { DummyApi } from './DummyApi'
import { DummyModuleConfig } from './DummyModuleConfig'
import { DummyRepository } from './repository'
import { DummyService } from './services'

export class DummyModule implements Module {
  public readonly config: DummyModuleConfig

  public readonly api = DummyApi

  public constructor(config?: DummyModuleConfigOptions) {
    this.config = new DummyModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Config
    dependencyManager.registerInstance(DummyModuleConfig, this.config)

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
