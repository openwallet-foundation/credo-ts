import type { DependencyManager, Module } from '@aries-framework/core'

import { DummyApi } from './DummyApi'
import { DummyRepository } from './repository'
import { DummyService } from './services'

export class DummyModule implements Module {
  public api = DummyApi

  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DummyApi)

    dependencyManager.registerSingleton(DummyRepository)
    dependencyManager.registerSingleton(DummyService)
  }
}
