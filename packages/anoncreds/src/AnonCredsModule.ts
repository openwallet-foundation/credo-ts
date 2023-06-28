import type { AnonCredsModuleConfigOptions } from './AnonCredsModuleConfig'
import type { DependencyManager, AgentContext, Module, Update } from '@aries-framework/core'

import { AnonCredsApi } from './AnonCredsApi'
import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import {
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRepository,
} from './repository'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'
import { updateAnonCredsModuleV0_3_1ToV0_4 } from './updates/0.3.1-0.4'

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
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    if (!this.config.autoCreateLinkSecret) return

    const anoncredsApi = agentContext.dependencyManager.resolve(AnonCredsApi)
    const linkSecretIds = await anoncredsApi.getLinkSecretIds()
    if (linkSecretIds.length === 0) {
      await anoncredsApi.createLinkSecret({
        setAsDefault: true,
      })
    }
  }

  public updates = [
    {
      fromVersion: '0.3.1',
      toVersion: '0.4',
      doUpdate: updateAnonCredsModuleV0_3_1ToV0_4,
    },
  ] satisfies Update[]
}
