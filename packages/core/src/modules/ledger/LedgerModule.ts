import type { DependencyManager, Module } from '../../plugins'
import type { LedgerModuleConfigOptions } from './LedgerModuleConfig'

import { InjectionSymbols } from '../../constants'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { LedgerApi } from './LedgerApi'
import { LedgerModuleConfig } from './LedgerModuleConfig'
import { IndyLedgerService, IndyPoolService } from './services/indy'

export class LedgerModule implements Module {
  public readonly config: LedgerModuleConfig

  public constructor(config?: LedgerModuleConfigOptions) {
    this.config = new LedgerModuleConfig(config)
  }

  /**
   * Registers the dependencies of the ledger module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(LedgerApi)

    // Config
    dependencyManager.registerInstance(LedgerModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(InjectionSymbols.LedgerService, IndyLedgerService)
    dependencyManager.registerSingleton(IndyPoolService)

    // Repositories
    dependencyManager.registerSingleton(AnonCredsCredentialDefinitionRepository)
    dependencyManager.registerSingleton(AnonCredsSchemaRepository)
  }
}
