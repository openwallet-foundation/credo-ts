import type { DependencyManager, Module } from '@aries-framework/core'

import { DummyRepository } from './repository'
import { DummyService } from './services'

export class DummyModule implements Module {
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DummyModule)

    dependencyManager.registerSingleton(DummyRepository)
    dependencyManager.registerSingleton(DummyService)
  }
}
