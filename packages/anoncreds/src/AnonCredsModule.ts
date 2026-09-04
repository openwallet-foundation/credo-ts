import type { DependencyManager, Module, Update } from '@credo-ts/core'
import { AnonCredsW3cCredentialServiceSymbol } from '@credo-ts/core'
import { DidCommDataIntegrityLinkSecretBindingProviderToken } from '@credo-ts/didcomm'
import { AnonCredsApi } from './AnonCredsApi'
import type { AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from './anoncreds-rs'
import { AnonCredsW3cCredentialService } from './anoncreds-rs/AnonCredsW3cCredentialService'
import { AnonCredsLinkSecretBindingProvider } from './formats/AnonCredsLinkSecretBindingProvider'
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

    dependencyManager.registerSingleton(AnonCredsW3cCredentialServiceSymbol, AnonCredsW3cCredentialService)

    // Makes the `anoncreds_link_secret` binding method of the W3C Data Integrity credential
    // attachment format available. Without it, that format only supports the binding methods that
    // do not require anoncreds.
    dependencyManager.registerSingleton(
      DidCommDataIntegrityLinkSecretBindingProviderToken,
      AnonCredsLinkSecretBindingProvider
    )
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
