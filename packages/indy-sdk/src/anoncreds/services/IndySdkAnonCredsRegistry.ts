import type { IndySdkPool } from '../../ledger'
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

import { parseIndyDid, verificationKeyForIndyDid } from '../../dids/didIndyUtil'
import { IndySdkError, isIndyError } from '../../error'
import { IndySdkPoolService } from '../../ledger'
import { IndySdkSymbol } from '../../types'
import {
  getDidIndyCredentialDefinitionId,
  getDidIndySchemaId,
  getLegacyCredentialDefinitionId,
  getLegacyRevocationRegistryId,
  getLegacySchemaId,
  indySdkAnonCredsRegistryIdentifierRegex,
  parseCredentialDefinitionId,
  parseRevocationRegistryId,
  parseSchemaId,
} from '../utils/identifiers'
import { anonCredsRevocationStatusListFromIndySdk } from '../utils/transform'

export class IndySdkAnonCredsRegistry implements AnonCredsRegistry {
  /**
   * This class supports resolving and registering objects with did:indy as well as legacy indy identifiers.
   * It needs to include support for the schema, credential definition, revocation registry as well
   * as the issuer id (which is needed when registering objects).
   */
  public readonly supportedIdentifier = indySdkAnonCredsRegistryIdentifierRegex

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      // parse schema id (supports did:indy and legacy)
      const { did, namespaceIdentifier, schemaName, schemaVersion } = parseSchemaId(schemaId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)
      agentContext.config.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.didIndyNamespace}'`)

      // even though we support did:indy and legacy identifiers we always need to fetch using the legacy identifier
      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, schemaName, schemaVersion)
      const request = await indySdk.buildGetSchemaRequest(null, legacySchemaId)

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

      return {
        schema: {
          attrNames: schema.attrNames,
          name: schema.name,
          version: schema.version,
          issuerId: did,
        },
        schemaId,
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
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    try {
      // This will throw an error if trying to register a schema with a legacy indy identifier. We only support did:indy identifiers
      // for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.
      const { namespaceIdentifier, namespace } = parseIndyDid(options.schema.issuerId)

      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const pool = indySdkPoolService.getPoolForNamespace(namespace)
      agentContext.config.logger.debug(
        `Register schema on ledger '${pool.didIndyNamespace}' with did '${options.schema.issuerId}'`,
        options.schema
      )

      const didIndySchemaId = getDidIndySchemaId(
        namespace,
        namespaceIdentifier,
        options.schema.name,
        options.schema.version
      )
      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, options.schema.name, options.schema.version)

      const schema = {
        attrNames: options.schema.attrNames,
        name: options.schema.name,
        version: options.schema.version,
        id: legacySchemaId,
        ver: '1.0',
        // Casted as because the type expect a seqNo, but that's not actually required for the input of
        // buildSchemaRequest (seqNo is not yet known)
      } as IndySdkSchema

      const request = await indySdk.buildSchemaRequest(namespaceIdentifier, schema)
      const submitterKey = await verificationKeyForIndyDid(agentContext, options.schema.issuerId)

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, submitterKey)
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
          schemaId: didIndySchemaId,
        },
        registrationMetadata: {},
        schemaMetadata: {
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo: response.result.txnMetadata.seqNo,
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

      // we support did:indy and legacy identifiers
      const { did, namespaceIdentifier, schemaSeqNo, tag } = parseCredentialDefinitionId(credentialDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.didIndyNamespace}' to retrieve credential definition '${credentialDefinitionId}'`
      )

      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, tag)
      const request = await indySdk.buildGetCredDefRequest(null, legacyCredentialDefinitionId)

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
      const { schema } = await this.fetchIndySchemaWithSeqNo(agentContext, pool, Number(credentialDefinition.schemaId))

      if (credentialDefinition && schema) {
        agentContext.config.logger.debug(
          `Got credential definition '${credentialDefinitionId}' from ledger '${pool.didIndyNamespace}'`,
          {
            credentialDefinition,
          }
        )

        // Format the schema id based on the type of the credential definition id
        const schemaId = credentialDefinitionId.startsWith('did:indy')
          ? getDidIndySchemaId(pool.didIndyNamespace, namespaceIdentifier, schema.name, schema.version)
          : schema.schemaId

        return {
          credentialDefinitionId,
          credentialDefinition: {
            issuerId: did,
            schemaId,
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
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    try {
      // This will throw an error if trying to register a credential defintion with a legacy indy identifier. We only support did:indy
      // identifiers for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.
      const { namespaceIdentifier, namespace } = parseIndyDid(options.credentialDefinition.issuerId)

      const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
      const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

      const pool = indySdkPoolService.getPoolForNamespace(namespace)
      agentContext.config.logger.debug(
        `Registering credential definition on ledger '${pool.didIndyNamespace}' with did '${options.credentialDefinition.issuerId}'`,
        options.credentialDefinition
      )

      // TODO: check structure of the schemaId
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

      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(
        namespaceIdentifier,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )
      const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
        namespace,
        namespaceIdentifier,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )

      const request = await indySdk.buildCredDefRequest(namespaceIdentifier, {
        id: legacyCredentialDefinitionId,
        // Indy ledger requires the credential schemaId to be a string of the schema seqNo.
        schemaId: schemaMetadata.indyLedgerSeqNo.toString(),
        tag: options.credentialDefinition.tag,
        type: options.credentialDefinition.type,
        value: options.credentialDefinition.value,
        ver: '1.0',
      })

      const submitterKey = await verificationKeyForIndyDid(agentContext, options.credentialDefinition.issuerId)
      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, submitterKey)

      agentContext.config.logger.debug(
        `Registered credential definition '${didIndyCredentialDefinitionId}' on ledger '${pool.didIndyNamespace}'`,
        {
          response,
          credentialDefinition: options.credentialDefinition,
        }
      )

      return {
        credentialDefinitionMetadata: {},
        credentialDefinitionState: {
          credentialDefinition: options.credentialDefinition,
          credentialDefinitionId: didIndyCredentialDefinitionId,
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

      const { did, namespaceIdentifier, credentialDefinitionTag, revocationRegistryTag, schemaSeqNo } =
        parseRevocationRegistryId(revocationRegistryDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.didIndyNamespace}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
      )

      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )
      const request = await indySdk.buildGetRevocRegDefRequest(null, legacyRevocationRegistryId)

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

      const credentialDefinitionId = revocationRegistryDefinitionId.startsWith('did:indy:')
        ? getDidIndyCredentialDefinitionId(
            pool.didIndyNamespace,
            namespaceIdentifier,
            schemaSeqNo,
            credentialDefinitionTag
          )
        : getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, credentialDefinitionTag)

      return {
        resolutionMetadata: {},
        revocationRegistryDefinition: {
          issuerId: did,
          credDefId: credentialDefinitionId,
          value: {
            maxCredNum: revocationRegistryDefinition.value.maxCredNum,
            publicKeys: revocationRegistryDefinition.value.publicKeys,
            tailsHash: revocationRegistryDefinition.value.tailsHash,
            tailsLocation: revocationRegistryDefinition.value.tailsLocation,
          },
          tag: revocationRegistryDefinition.tag,
          revocDefType: 'CL_ACCUM',
        },
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

      const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
        parseRevocationRegistryId(revocationRegistryId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.didIndyNamespace}' to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryId}' until ${timestamp}`
      )

      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )

      // TODO: implement caching for returned deltas
      const request = await indySdk.buildGetRevocRegDeltaRequest(null, legacyRevocationRegistryId, 0, timestamp)

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

  private async fetchIndySchemaWithSeqNo(agentContext: AgentContext, pool: IndySdkPool, seqNo: number) {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)

    agentContext.config.logger.debug(`Getting transaction with seqNo '${seqNo}' from ledger '${pool.didIndyNamespace}'`)

    const request = await indySdk.buildGetTxnRequest(null, 'DOMAIN', seqNo)

    agentContext.config.logger.trace(`Submitting get transaction request to ledger '${pool.didIndyNamespace}'`)
    const response = await indySdkPoolService.submitReadRequest(pool, request)

    const schema = response.result.data as SchemaType

    if (schema.txn.type !== '101') {
      agentContext.config.logger.error(`Could not get schema from ledger for seq no ${seqNo}'`)
      return {}
    }

    return {
      schema: {
        // txnId is the schema id
        schemaId: schema.txnMetadata.txnId,
        attr_name: schema.txn.data.data.attr_names,
        name: schema.txn.data.data.name,
        version: schema.txn.data.data.version,
        issuerId: schema.txn.metadata.from,
        seqNo,
      },
      indyNamespace: pool.didIndyNamespace,
    }
  }
}

interface SchemaType {
  txnMetadata: {
    txnId: string
  }
  txn: {
    metadata: {
      from: string
    }
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
