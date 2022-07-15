import type { DependencyManager } from '@aries-framework/core'

import { module } from '@aries-framework/core'

import { DummyRepository } from './repository'
import { DummyService } from './services'

@module()
export class DummyModule {
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DummyModule)

    dependencyManager.registerSingleton(DummyRepository)
    dependencyManager.registerSingleton(DummyService)
  }
}
