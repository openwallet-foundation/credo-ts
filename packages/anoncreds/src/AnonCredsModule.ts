import type { DependencyManager, Module, Update } from '@credo-ts/core'
import type { AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'

import { AnonCredsDataIntegrityServiceSymbol } from '@credo-ts/core'

import { AnonCredsApi } from './AnonCredsApi'
import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from './anoncreds-rs'
import { AnonCredsDataIntegrityService } from './anoncreds-rs/AnonCredsDataIntegrityService'
import {
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRepository,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryDefinitionRepository,
} from './repository'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsHolderServiceSymbol, AnonCredsIssuerServiceSymbol, AnonCredsVerifierServiceSymbol } from './services'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'
import { updateAnonCredsModuleV0_3_1ToV0_4 } from './updates/0.3.1-0.4'
import { updateAnonCredsModuleV0_4ToV0_5 } from './updates/0.4-0.5'

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

    // TODO: should we allow to override the service?
    dependencyManager.registerSingleton(AnonCredsHolderServiceSymbol, AnonCredsRsHolderService)
    dependencyManager.registerSingleton(AnonCredsIssuerServiceSymbol, AnonCredsRsIssuerService)
    dependencyManager.registerSingleton(AnonCredsVerifierServiceSymbol, AnonCredsRsVerifierService)

    dependencyManager.registerSingleton(AnonCredsDataIntegrityServiceSymbol, AnonCredsDataIntegrityService)
  }

  public updates = [
    {
      fromVersion: '0.3.1',
      toVersion: '0.4',
      doUpdate: updateAnonCredsModuleV0_3_1ToV0_4,
    },
    {
      fromVersion: '0.4',
      toVersion: '0.5',
      doUpdate: updateAnonCredsModuleV0_4ToV0_5,
    },
  ] satisfies Update[]
}
