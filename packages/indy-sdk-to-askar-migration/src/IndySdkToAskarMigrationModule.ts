import type { DependencyManager, Module } from '@aries-framework/core'

import { IndySdkToAskarMigrationApi } from './IndySdkToAskarMigrationApi'
import { IndySdkToAskarMigrationService } from './services/IndySdkToAskarMigrationService'

export class IndySdkToAskarMigrationModule implements Module {
  public readonly api = IndySdkToAskarMigrationApi

  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(IndySdkToAskarMigrationApi)

    // Services
    dependencyManager.registerSingleton(IndySdkToAskarMigrationService)
  }
}
