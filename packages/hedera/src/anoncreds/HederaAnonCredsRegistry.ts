import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '@credo-ts/anoncreds'
import type { AgentContext } from '@credo-ts/core'
import { HederaModuleConfig } from '../HederaModuleConfig'
import { HederaAnonCredsService } from './HederaAnonCredsService'

export class HederaAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'hedera'
  public readonly supportedIdentifier = /^did:hedera:.*$/

  public allowsCaching = true
  public allowsLocalRecord = true

  private anonCredsService?: HederaAnonCredsService

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    try {
      agentContext.config.logger.trace('Registering schema on Hedera ledger')
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.registerSchema(agentContext, options)
    } catch (error) {
      agentContext.config.logger.debug(`Error registering schema for did '${options.schema.issuerId}'`, {
        error,
        did: options.schema.issuerId,
        schema: options,
      })
      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: options.schema,
          reason: `Unable to register schema: ${error.message}`,
        },
      }
    }
  }

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      agentContext.config.logger.trace(`Resolving schema '${schemaId}' from Hedera ledger`)
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.getSchema(agentContext, schemaId)
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving schema '${schemaId}'`, {
        error,
        schemaId,
      })
      return {
        schemaId,
        resolutionMetadata: {
          error: 'notFound',
          message: `Unable to resolve schema: ${error.message}`,
        },
        schemaMetadata: {},
      }
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    try {
      agentContext.config.logger.trace('Registering credential definition on Hedera ledger')
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.registerCredentialDefinition(agentContext, options)
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering credential definition for did '${options.credentialDefinition.issuerId}'`,
        {
          error,
          did: options.credentialDefinition.issuerId,
          schema: options,
        }
      )
      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: options.credentialDefinition,
          reason: `Unable to register credential definition: ${error.message}`,
        },
      }
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    try {
      agentContext.config.logger.trace(`Resolving credential definition '${credentialDefinitionId}' from Hedera ledger`)
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.getCredentialDefinition(agentContext, credentialDefinitionId)
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`, {
        error,
        credentialDefinitionId,
      })
      return {
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'notFound',
          message: `Unable to resolve credential definition: ${error.message}`,
        },
        credentialDefinitionMetadata: {},
      }
    }
  }

  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    options: RegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    try {
      agentContext.config.logger.trace(
        `Registering revocation registry definition for '${options.revocationRegistryDefinition.credDefId}' on Hedera ledger`
      )
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.registerRevocationRegistryDefinition(agentContext, options)
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation registry definition for did '${options.revocationRegistryDefinition.issuerId}'`,
        {
          error,
          did: options.revocationRegistryDefinition.issuerId,
          options,
        }
      )
      return {
        revocationRegistryDefinitionMetadata: {},
        registrationMetadata: {},
        revocationRegistryDefinitionState: {
          state: 'failed',
          revocationRegistryDefinition: options.revocationRegistryDefinition,
          reason: `Unable to register revocation registry definition: ${error.message}`,
        },
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      agentContext.config.logger.trace(
        `Resolving revocation registry definition for '${revocationRegistryDefinitionId}' from Hedera ledger`
      )
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.getRevocationRegistryDefinition(agentContext, revocationRegistryDefinitionId)
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}'`,
        {
          error,
          revocationRegistryDefinitionId,
        }
      )
      return {
        revocationRegistryDefinitionId,
        resolutionMetadata: {
          error: 'notFound',
          message: `Unable to resolve revocation registry definition: ${error.message}`,
        },
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async registerRevocationStatusList(
    agentContext: AgentContext,
    options: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    try {
      agentContext.config.logger.trace(
        `Registering revocation status list for '${options.revocationStatusList.revRegDefId}' on Hedera ledger`
      )
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.registerRevocationStatusList(agentContext, options)
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation status list for did '${options.revocationStatusList.issuerId}'`,
        {
          error,
          did: options.revocationStatusList.issuerId,
          options,
        }
      )
      return {
        revocationStatusListMetadata: {},
        registrationMetadata: {},
        revocationStatusListState: {
          state: 'failed',
          revocationStatusList: options.revocationStatusList,
          reason: `Unable to register revocation status list: ${error.message}`,
        },
      }
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    try {
      agentContext.config.logger.trace(
        `Resolving revocation status for for '${revocationRegistryId}' from Hedera ledger`
      )
      const anonCredsService = this.getAnonCredsService(agentContext)
      return await anonCredsService.getRevocationStatusList(agentContext, revocationRegistryId, timestamp * 1000)
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving revocation registry status list '${revocationRegistryId}'`, {
        error,
        revocationRegistryId,
      })
      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Unable to resolve revocation registry status list: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
  }

  private getAnonCredsService(agentContext: AgentContext): HederaAnonCredsService {
    if (!this.anonCredsService) {
      const dependencyManager = agentContext.dependencyManager
      if (!dependencyManager.isRegistered(HederaModuleConfig, true)) {
        throw new Error(
          'HederaModuleConfig is not registered. Add HederaModule from @credo-ts/hedera to the agent modules.'
        )
      }

      this.anonCredsService = new HederaAnonCredsService(dependencyManager.resolve(HederaModuleConfig))
    }

    return this.anonCredsService
  }
}
