import type { IndySdk } from '../../types'
import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { Schema as IndySdkSchema } from 'indy-sdk'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdkPoolService } from '../../ledger'
import { IndySdkSymbol } from '../../types'
import {
  didFromCredentialDefinitionId,
  didFromRevocationRegistryDefinitionId,
  didFromSchemaId,
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
  indySdkAnonCredsRegistryIdentifierRegex,
} from '../utils/identifiers'
import {
  anonCredsRevocationStatusListFromIndySdk,
  anonCredsRevocationRegistryDefinitionFromIndySdk,
} from '../utils/transform'

/**
 * TODO: validation of the identifiers. The Indy SDK classes only support the legacy (unqualified) identifiers.
 */
export class IndySdkAnonCredsRegistry implements AnonCredsRegistry {
  /**
   * This class only supports resolving and registering objects with legacy indy identifiers.
   * It needs to include support for the schema, credential definition, revocation registry as well
   * as the issuer id (which is needed when registering objects).
   */
  public readonly supportedIdentifier = indySdkAnonCredsRegistryIdentifierRegex

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const did = didFromSchemaId(schemaId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)
      agentContext.config.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.didIndyNamespace}'`)

      const request = await indySdk.buildGetSchemaRequest(null, schemaId)

      agentContext.config.logger.trace(
        `Submitting get schema request for schema '${schemaId}' to ledger '${pool.didIndyNamespace}'`
      )
      const response = await indySdkPoolService.submitReadRequest(pool, request)

      agentContext.config.logger.trace(`Got un-parsed schema '${schemaId}' from ledger '${pool.didIndyNamespace}'`, {
        response,
      })

      const [, schema] = await indySdk.parseGetSchemaResponse(response)
      agentContext.config.logger.debug(`Got schema '${schemaId}' from ledger '${pool.didIndyNamespace}'`, {
        schema,
      })

      const issuerId = didFromSchemaId(schema.id)

      return {
        schema: {
          attrNames: schema.attrNames,
          name: schema.name,
          version: schema.version,
          issuerId: issuerId,
        },
        schemaId: schema.id,
        resolutionMetadata: {},
        schemaMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo: schema.seqNo,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving schema '${schemaId}'`, {
        error,
        schemaId,
      })

      return {
        schemaId,
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve credential definition: ${error.message}`,
        },
        schemaMetadata: {},
      }
    }
  }

  public async registerSchema(
    agentContext: AgentContext,
    options: IndySdkRegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    // Make sure didIndyNamespace is passed
    if (!options.options.didIndyNamespace) {
      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          reason: 'no didIndyNamespace defined in the options. didIndyNamespace is required when using the Indy SDK',
          schema: options.schema,
          state: 'failed',
        },
      }
    }

    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const pool = indySdkPoolService.getPoolForNamespace(options.options.didIndyNamespace)
      agentContext.config.logger.debug(
        `Register schema on ledger '${pool.didIndyNamespace}' with did '${options.schema.issuerId}'`,
        options.schema
      )

      const schema = {
        attrNames: options.schema.attrNames,
        name: options.schema.name,
        version: options.schema.version,
        id: getLegacySchemaId(options.schema.issuerId, options.schema.name, options.schema.version),
        ver: '1.0',
        // Casted as because the type expect a seqNo, but that's not actually required for the input of
        // buildSchemaRequest (seqNo is not yet known)
      } as IndySdkSchema

      const request = await indySdk.buildSchemaRequest(options.schema.issuerId, schema)

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, options.schema.issuerId)
      agentContext.config.logger.debug(`Registered schema '${schema.id}' on ledger '${pool.didIndyNamespace}'`, {
        response,
        schema,
      })

      return {
        schemaState: {
          state: 'finished',
          schema: {
            attrNames: schema.attrNames,
            issuerId: options.schema.issuerId,
            name: schema.name,
            version: schema.version,
          },
          schemaId: schema.id,
        },
        registrationMetadata: {},
        schemaMetadata: {
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo: response.result.txnMetadata.seqNo,
          didIndyNamespace: pool.didIndyNamespace,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error registering schema for did '${options.schema.issuerId}'`, {
        error,
        did: options.schema.issuerId,
        schema: options.schema,
      })

      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: options.schema,
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const did = didFromCredentialDefinitionId(credentialDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.didIndyNamespace}' to retrieve credential definition '${credentialDefinitionId}'`
      )
      const request = await indySdk.buildGetCredDefRequest(null, credentialDefinitionId)

      agentContext.config.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger '${pool.didIndyNamespace}'`
      )

      const response = await indySdkPoolService.submitReadRequest(pool, request)
      agentContext.config.logger.trace(
        `Got un-parsed credential definition '${credentialDefinitionId}' from ledger '${pool.didIndyNamespace}'`,
        {
          response,
        }
      )

      const [, credentialDefinition] = await indySdk.parseGetCredDefResponse(response)
      const { schema } = await this.fetchIndySchemaWithSeqNo(agentContext, Number(credentialDefinition.schemaId), did)

      if (credentialDefinition && schema) {
        agentContext.config.logger.debug(
          `Got credential definition '${credentialDefinitionId}' from ledger '${pool.didIndyNamespace}'`,
          {
            credentialDefinition,
          }
        )

        return {
          credentialDefinitionId: credentialDefinition.id,
          credentialDefinition: {
            issuerId: didFromCredentialDefinitionId(credentialDefinition.id),
            schemaId: schema.schemaId,
            tag: credentialDefinition.tag,
            type: 'CL',
            value: credentialDefinition.value,
          },
          credentialDefinitionMetadata: {
            didIndyNamespace: pool.didIndyNamespace,
          },
          resolutionMetadata: {},
        }
      }

      agentContext.config.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`, {
        credentialDefinitionId,
      })

      return {
        credentialDefinitionId,
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve credential definition`,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`, {
        error,
        credentialDefinitionId,
      })

      return {
        credentialDefinitionId,
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve credential definition: ${error.message}`,
        },
      }
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options: IndySdkRegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    // Make sure didIndyNamespace is passed
    if (!options.options.didIndyNamespace) {
      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          reason: 'no didIndyNamespace defined in the options. didIndyNamespace is required when using the Indy SDK',
          credentialDefinition: options.credentialDefinition,
          state: 'failed',
        },
      }
    }

    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const pool = indySdkPoolService.getPoolForNamespace(options.options.didIndyNamespace)
      agentContext.config.logger.debug(
        `Registering credential definition on ledger '${pool.didIndyNamespace}' with did '${options.credentialDefinition.issuerId}'`,
        options.credentialDefinition
      )

      // TODO: this will bypass caching if done on a higher level.
      const { schema, schemaMetadata, resolutionMetadata } = await this.getSchema(
        agentContext,
        options.credentialDefinition.schemaId
      )

      if (!schema || !schemaMetadata.indyLedgerSeqNo || typeof schemaMetadata.indyLedgerSeqNo !== 'number') {
        return {
          registrationMetadata: {},
          credentialDefinitionMetadata: {
            didIndyNamespace: pool.didIndyNamespace,
          },
          credentialDefinitionState: {
            credentialDefinition: options.credentialDefinition,
            state: 'failed',
            reason: `error resolving schema with id ${options.credentialDefinition.schemaId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
        }
      }

      const credentialDefinitionId = getLegacyCredentialDefinitionId(
        options.credentialDefinition.issuerId,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )

      const request = await indySdk.buildCredDefRequest(options.credentialDefinition.issuerId, {
        id: credentialDefinitionId,
        schemaId: schemaMetadata.indyLedgerSeqNo.toString(),
        tag: options.credentialDefinition.tag,
        type: options.credentialDefinition.type,
        value: options.credentialDefinition.value,
        ver: '1.0',
      })

      const response = await indySdkPoolService.submitWriteRequest(
        agentContext,
        pool,
        request,
        options.credentialDefinition.issuerId
      )

      agentContext.config.logger.debug(
        `Registered credential definition '${credentialDefinitionId}' on ledger '${pool.didIndyNamespace}'`,
        {
          response,
          credentialDefinition: options.credentialDefinition,
        }
      )

      return {
        credentialDefinitionMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
        },
        credentialDefinitionState: {
          credentialDefinition: options.credentialDefinition,
          credentialDefinitionId,
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering credential definition for schema '${options.credentialDefinition.schemaId}'`,
        {
          error,
          did: options.credentialDefinition.issuerId,
          credentialDefinition: options.credentialDefinition,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.didIndyNamespace}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
      )
      const request = await indySdk.buildGetRevocRegDefRequest(null, revocationRegistryDefinitionId)

      agentContext.config.logger.trace(
        `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await indySdkPoolService.submitReadRequest(pool, request)
      agentContext.config.logger.trace(
        `Got un-parsed revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.didIndyNamespace}'`,
        {
          response,
        }
      )

      const [, revocationRegistryDefinition] = await indySdk.parseGetRevocRegDefResponse(response)

      agentContext.config.logger.debug(
        `Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          revocationRegistryDefinition,
        }
      )

      return {
        resolutionMetadata: {},
        revocationRegistryDefinition: anonCredsRevocationRegistryDefinitionFromIndySdk(revocationRegistryDefinition),
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {
          issuanceType: revocationRegistryDefinition.value.issuanceType,
          didIndyNamespace: pool.didIndyNamespace,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry definition: ${error.message}`,
        },
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const did = didFromRevocationRegistryDefinitionId(revocationRegistryId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.id}' to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryId}' until ${timestamp}`
      )

      // TODO: implement caching for returned deltas
      const request = await indySdk.buildGetRevocRegDeltaRequest(null, revocationRegistryId, 0, timestamp)

      agentContext.config.logger.trace(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryId}' to ledger`
      )

      const response = await indySdkPoolService.submitReadRequest(pool, request)
      agentContext.config.logger.trace(
        `Got revocation registry delta unparsed-response '${revocationRegistryId}' from ledger`,
        {
          response,
        }
      )

      const [, revocationRegistryDelta, deltaTimestamp] = await indySdk.parseGetRevocRegDeltaResponse(response)

      agentContext.config.logger.debug(
        `Got revocation registry deltas '${revocationRegistryId}' until timestamp ${timestamp} from ledger`,
        {
          revocationRegistryDelta,
          deltaTimestamp,
        }
      )

      const { resolutionMetadata, revocationRegistryDefinition, revocationRegistryDefinitionMetadata } =
        await this.getRevocationRegistryDefinition(agentContext, revocationRegistryId)

      if (
        !revocationRegistryDefinition ||
        !revocationRegistryDefinitionMetadata.issuanceType ||
        typeof revocationRegistryDefinitionMetadata.issuanceType !== 'string'
      ) {
        return {
          resolutionMetadata: {
            error: `error resolving revocation registry definition with id ${revocationRegistryId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
          revocationStatusListMetadata: {
            didIndyNamespace: pool.didIndyNamespace,
          },
        }
      }

      const isIssuanceByDefault = revocationRegistryDefinitionMetadata.issuanceType === 'ISSUANCE_BY_DEFAULT'

      return {
        resolutionMetadata: {},
        revocationStatusList: anonCredsRevocationStatusListFromIndySdk(
          revocationRegistryId,
          revocationRegistryDefinition,
          revocationRegistryDelta,
          deltaTimestamp,
          isIssuanceByDefault
        ),
        revocationStatusListMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation?"`,
        {
          error,
          revocationRegistryId: revocationRegistryId,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
  }

  private async fetchIndySchemaWithSeqNo(agentContext: AgentContext, seqNo: number, did: string) {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

    const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)
    agentContext.config.logger.debug(`Getting transaction with seqNo '${seqNo}' from ledger '${pool.didIndyNamespace}'`)

    const request = await indySdk.buildGetTxnRequest(did, 'DOMAIN', seqNo)

    agentContext.config.logger.trace(`Submitting get transaction request to ledger '${pool.didIndyNamespace}'`)
    const response = await indySdkPoolService.submitReadRequest(pool, request)

    const schema = response.result.data as SchemaType

    if (schema.txn.type !== '101') {
      agentContext.config.logger.error(`Could not get schema from ledger for seq no ${seqNo}'`)
      return {}
    }

    const schemaId = getLegacySchemaId(did, schema.txn.data.data.name, schema.txn.data.data.version)

    return {
      schema: {
        schemaId,
        attr_name: schema.txn.data.data.attr_names,
        name: schema.txn.data.data.name,
        version: schema.txn.data.data.version,
        issuerId: did,
        seqNo,
      },
      indyNamespace: pool.didIndyNamespace,
    }
  }
}

interface SchemaType {
  txn: {
    data: {
      data: {
        attr_names: string[]
        version: string
        name: string
      }
    }

    type: string
  }
}

export interface IndySdkRegisterSchemaOptions extends RegisterSchemaOptions {
  options: {
    didIndyNamespace: string
  }
}

export interface IndySdkRegisterCredentialDefinitionOptions extends RegisterCredentialDefinitionOptions {
  options: {
    didIndyNamespace: string
  }
}
