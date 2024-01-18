import type { AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
import type { DependencyManager, Module, Update } from '@aries-framework/core'

import { AnonCredsApi } from './AnonCredsApi'
import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import {
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryDefinitionRepository,
} from './repository'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'
import { updateAnonCredsModuleV0_3_1ToV0_4 } from './updates/0.3.1-0.4'
import { updateAnonCredsModuleV0_4_1ToV0_5 } from './updates/0.4-0.5'

/**
 * @public
 */
export class AnonCredsModule implements Module {
  public readonly config: AnonCredsModuleConfig
  public api = AnonCredsApi

  public constructor(config: AnonCredsModuleConfigOptions) {
    this.config = new AnonCredsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(AnonCredsModuleConfig, this.config)

    dependencyManager.registerSingleton(AnonCredsRegistryService)

    // Repositories
    dependencyManager.registerSingleton(AnonCredsSchemaRepository)
    dependencyManager.registerSingleton(AnonCredsCredentialDefinitionRepository)
    dependencyManager.registerSingleton(AnonCredsCredentialDefinitionPrivateRepository)
    dependencyManager.registerSingleton(AnonCredsKeyCorrectnessProofRepository)
    dependencyManager.registerSingleton(AnonCredsLinkSecretRepository)
    dependencyManager.registerSingleton(AnonCredsRevocationRegistryDefinitionRepository)
    dependencyManager.registerSingleton(AnonCredsRevocationRegistryDefinitionPrivateRepository)
  }

  public updates = [
    {
      fromVersion: '0.3.1',
      toVersion: '0.4',
      doUpdate: updateAnonCredsModuleV0_3_1ToV0_4,
    },
    {
      fromVersion: '0.4.1',
      toVersion: '0.5',
      doUpdate: updateAnonCredsModuleV0_4_1ToV0_5,
    },
  ] satisfies Update[]
}
