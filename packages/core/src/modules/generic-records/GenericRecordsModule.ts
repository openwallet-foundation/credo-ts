import type { DependencyManager, Module } from '../../plugins'

import { GenericRecordsApi } from './GenericRecordsApi'
import { GenericRecordsRepository } from './repository/GenericRecordsRepository'
import { GenericRecordService } from './services/GenericRecordService'

export class GenericRecordsModule implements Module {
  public readonly api = GenericRecordsApi

  /**
   * Registers the dependencies of the generic records module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(GenericRecordsApi)

    // Services
    dependencyManager.registerSingleton(GenericRecordService)

    // Repositories
    dependencyManager.registerSingleton(GenericRecordsRepository)
  }
}
