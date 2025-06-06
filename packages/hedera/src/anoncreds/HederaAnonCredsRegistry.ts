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
import { HederaLedgerService } from '../ledger'

export class HederaAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'hedera'
  public readonly supportedIdentifier = /^did:hedera:.*$/

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    try {
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace('Submitting register schema request to ledger')
      return await sdk.registerSchema(options)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(`Submitting get schema request for schema '${schemaId}' to ledger`)
      return await sdk.getSchema(schemaId)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace('Submitting register credential definition request to ledger')
      return await sdk.registerCredentialDefinition(options)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(
        `Submitting get credential definition request for '${credentialDefinitionId}' to ledger`
      )
      return await sdk.getCredentialDefinition(credentialDefinitionId)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(
        `Submitting register revocation registry definition request for '${options.revocationRegistryDefinition.credDefId}' to ledger`
      )
      return await sdk.registerRevocationRegistryDefinition(options)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(
        `Submitting get revocation registry definition request for '${revocationRegistryDefinitionId}' to ledger`
      )
      return await sdk.getRevocationRegistryDefinition(revocationRegistryDefinitionId)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(
        `Submitting register revocation status list request for '${options.revocationStatusList.revRegDefId}' to ledger`
      )
      return await sdk.registerRevocationStatusList(options)
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
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)
      const sdk = ledgerService.getHederaAnonCredsSdk(agentContext)
      agentContext.config.logger.trace(
        `Submitting get revocation status request for '${revocationRegistryId}' to ledger`
      )
      return await sdk.getRevocationStatusList(revocationRegistryId, timestamp)
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
}
