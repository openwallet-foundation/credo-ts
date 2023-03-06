import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetSchemaReturn,
  RegisterSchemaOptions,
  RegisterCredentialDefinitionOptions,
  RegisterSchemaReturn,
  RegisterCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  AnonCredsRevocationRegistryDefinition,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import {
  GetSchemaRequest,
  SchemaRequest,
  GetCredentialDefinitionRequest,
  CredentialDefinitionRequest,
  GetTransactionRequest,
  GetRevocationRegistryDeltaRequest,
  GetRevocationRegistryDefinitionRequest,
} from '@hyperledger/indy-vdr-shared'

import { parseIndyDid, verificationKeyForIndyDid } from '../dids/didIndyUtil'
import { IndyVdrPoolService } from '../pool'

import {
  getLegacySchemaId,
  getLegacyCredentialDefinitionId,
  indyVdrAnonCredsRegistryIdentifierRegex,
  parseSchemaId,
  getDidIndySchemaId,
  parseCredentialDefinitionId,
  getDidIndyCredentialDefinitionId,
  parseRevocationRegistryId,
  getLegacyRevocationRegistryId,
} from './utils/identifiers'
import { anonCredsRevocationStatusListFromIndyVdr } from './utils/transform'

export class IndyVdrAnonCredsRegistry implements AnonCredsRegistry {
  public readonly supportedIdentifier = indyVdrAnonCredsRegistryIdentifierRegex

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      // parse schema id (supports did:indy and legacy)
      const { did, namespaceIdentifier, schemaName, schemaVersion } = parseSchemaId(schemaId)
      const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, did)
      agentContext.config.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.indyNamespace}'`)

      // even though we support did:indy and legacy identifiers we always need to fetch using the legacy identifier
      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, schemaName, schemaVersion)
      const request = new GetSchemaRequest({ schemaId: legacySchemaId })

      agentContext.config.logger.trace(
        `Submitting get schema request for schema '${schemaId}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitReadRequest(request)

      agentContext.config.logger.trace(`Got un-parsed schema '${schemaId}' from ledger '${pool.indyNamespace}'`, {
        response,
      })

      if (!('attr_names' in response.result.data)) {
        agentContext.config.logger.error(`Error retrieving schema '${schemaId}'`)

        return {
          schemaId,
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to find schema with id ${schemaId}`,
          },
          schemaMetadata: {},
        }
      }

      return {
        schema: {
          attrNames: response.result.data.attr_names,
          name: response.result.data.name,
          version: response.result.data.version,
          issuerId: did,
        },
        schemaId,
        resolutionMetadata: {},
        schemaMetadata: {
          didIndyNamespace: pool.indyNamespace,
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo: response.result.seqNo,
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

      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const pool = indyVdrPoolService.getPoolForNamespace(namespace)
      agentContext.config.logger.debug(
        `Register schema on ledger '${pool.indyNamespace}' with did '${options.schema.issuerId}'`,
        options.schema
      )

      const didIndySchemaId = getDidIndySchemaId(
        namespace,
        namespaceIdentifier,
        options.schema.name,
        options.schema.version
      )
      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, options.schema.name, options.schema.version)

      const schemaRequest = new SchemaRequest({
        submitterDid: namespaceIdentifier,
        schema: {
          id: legacySchemaId,
          name: options.schema.name,
          ver: '1.0',
          version: options.schema.version,
          attrNames: options.schema.attrNames,
        },
      })

      const submitterKey = await verificationKeyForIndyDid(agentContext, options.schema.issuerId)
      const response = await pool.submitWriteRequest(agentContext, schemaRequest, submitterKey)
      agentContext.config.logger.debug(`Registered schema '${didIndySchemaId}' on ledger '${pool.indyNamespace}'`, {
        response,
        schemaRequest,
      })

      return {
        schemaState: {
          state: 'finished',
          schema: {
            attrNames: options.schema.attrNames,
            issuerId: options.schema.issuerId,
            name: options.schema.name,
            version: options.schema.version,
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
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      // we support did:indy and legacy identifiers
      const { did, namespaceIdentifier, schemaSeqNo, tag } = parseCredentialDefinitionId(credentialDefinitionId)
      const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Getting credential definition '${credentialDefinitionId}' from ledger '${pool.indyNamespace}'`
      )

      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, tag)
      const request = new GetCredentialDefinitionRequest({
        credentialDefinitionId: legacyCredentialDefinitionId,
      })

      agentContext.config.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitReadRequest(request)

      // We need to fetch the schema to determine the schemaId (we only have the seqNo)
      const schema = await this.fetchIndySchemaWithSeqNo(agentContext, response.result.ref, namespaceIdentifier)

      if (!schema || !response.result.data) {
        agentContext.config.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`)

        return {
          credentialDefinitionId,
          credentialDefinitionMetadata: {},
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to resolve credential definition with id ${credentialDefinitionId}`,
          },
        }
      }

      // Format the schema id based on the type of the credential definition id
      const schemaId = credentialDefinitionId.startsWith('did:indy')
        ? getDidIndySchemaId(pool.indyNamespace, namespaceIdentifier, schema.schema.name, schema.schema.version)
        : schema.schema.schemaId

      return {
        credentialDefinitionId: credentialDefinitionId,
        credentialDefinition: {
          issuerId: did,
          schemaId,
          tag: response.result.tag,
          type: 'CL',
          value: response.result.data,
        },
        credentialDefinitionMetadata: {
          didIndyNamespace: pool.indyNamespace,
        },
        resolutionMetadata: {},
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

      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const pool = indyVdrPoolService.getPoolForNamespace(namespace)
      agentContext.config.logger.debug(
        `Registering credential definition on ledger '${pool.indyNamespace}' with did '${options.credentialDefinition.issuerId}'`,
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
            didIndyNamespace: pool.indyNamespace,
          },
          credentialDefinitionState: {
            credentialDefinition: options.credentialDefinition,
            state: 'failed',
            reason: `error resolving schema with id ${options.credentialDefinition.schemaId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
        }
      }

      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(
        options.credentialDefinition.issuerId,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )
      const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
        namespace,
        namespaceIdentifier,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )

      const credentialDefinitionRequest = new CredentialDefinitionRequest({
        submitterDid: namespaceIdentifier,
        credentialDefinition: {
          ver: '1.0',
          id: legacyCredentialDefinitionId,
          schemaId: `${schemaMetadata.indyLedgerSeqNo}`,
          type: 'CL',
          tag: options.credentialDefinition.tag,
          value: options.credentialDefinition.value,
        },
      })

      const submitterKey = await verificationKeyForIndyDid(agentContext, options.credentialDefinition.issuerId)
      const response = await pool.submitWriteRequest(agentContext, credentialDefinitionRequest, submitterKey)
      agentContext.config.logger.debug(
        `Registered credential definition '${didIndyCredentialDefinitionId}' on ledger '${pool.indyNamespace}'`,
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

      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          credentialDefinition: options.credentialDefinition,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const { did, namespaceIdentifier, credentialDefinitionTag, revocationRegistryTag, schemaSeqNo } =
        parseRevocationRegistryId(revocationRegistryDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.indyNamespace}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
      )

      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )
      const request = new GetRevocationRegistryDefinitionRequest({
        revocationRegistryId: legacyRevocationRegistryId,
      })

      agentContext.config.logger.trace(
        `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        agentContext.config.logger.error(
          `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
          {
            revocationRegistryDefinitionId,
          }
        )

        return {
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to resolve revocation registry definition`,
          },
          revocationRegistryDefinitionId,
          revocationRegistryDefinitionMetadata: {},
        }
      }

      agentContext.config.logger.trace(
        `Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.indyNamespace}'`,
        {
          response,
        }
      )

      const credentialDefinitionId = revocationRegistryDefinitionId.startsWith('did:indy:')
        ? getDidIndyCredentialDefinitionId(
            pool.indyNamespace,
            namespaceIdentifier,
            schemaSeqNo,
            credentialDefinitionTag
          )
        : getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, credentialDefinitionTag)

      const revocationRegistryDefinition = {
        issuerId: did,
        revocDefType: response.result.data.revocDefType,
        value: {
          maxCredNum: response.result.data.value.maxCredNum,
          tailsHash: response.result.data.value.tailsHash,
          tailsLocation: response.result.data.value.tailsLocation,
          publicKeys: {
            accumKey: {
              z: response.result.data.value.publicKeys.accumKey.z,
            },
          },
        },
        tag: response.result.data.tag,
        credDefId: credentialDefinitionId,
      } satisfies AnonCredsRevocationRegistryDefinition

      return {
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        revocationRegistryDefinitionMetadata: {
          issuanceType: response.result.data.value.issuanceType,
          didIndyNamespace: pool.indyNamespace,
        },
        resolutionMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId,
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
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
        parseRevocationRegistryId(revocationRegistryId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.indyNamespace}' to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryId}' until ${timestamp}`
      )

      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )
      const request = new GetRevocationRegistryDeltaRequest({
        revocationRegistryId: legacyRevocationRegistryId,
        toTs: timestamp,
      })

      agentContext.config.logger.trace(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryId}' to ledger`
      )
      const response = await pool.submitReadRequest(request)

      agentContext.config.logger.debug(
        `Got revocation registry deltas '${revocationRegistryId}' until timestamp ${timestamp} from ledger`
      )

      const { revocationRegistryDefinition, resolutionMetadata, revocationRegistryDefinitionMetadata } =
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
            didIndyNamespace: pool.indyNamespace,
          },
        }
      }

      const isIssuanceByDefault = revocationRegistryDefinitionMetadata.issuanceType === 'ISSUANCE_BY_DEFAULT'

      if (!response.result.data) {
        return {
          resolutionMetadata: {
            error: 'notFound',
            message: `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation`,
          },
          revocationStatusListMetadata: {},
        }
      }

      const revocationRegistryDelta = {
        accum: response.result.data.value.accum_to.value.accum,
        issued: response.result.data.value.issued,
        revoked: response.result.data.value.revoked,
      }

      return {
        resolutionMetadata: {},
        revocationStatusList: anonCredsRevocationStatusListFromIndyVdr(
          revocationRegistryId,
          revocationRegistryDefinition,
          revocationRegistryDelta,
          response.result.data.value.accum_to.txnTime,
          isIssuanceByDefault
        ),
        revocationStatusListMetadata: {
          didIndyNamespace: pool.indyNamespace,
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
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, did)

    agentContext.config.logger.debug(`Getting transaction with seqNo '${seqNo}' from ledger '${pool.indyNamespace}'`)
    // ledgerType 1 is domain ledger
    const request = new GetTransactionRequest({ ledgerType: 1, seqNo })

    agentContext.config.logger.trace(`Submitting get transaction request to ledger '${pool.indyNamespace}'`)
    const response = await pool.submitReadRequest(request)

    if (response.result.data?.txn.type !== '101') {
      agentContext.config.logger.error(`Could not get schema from ledger for seq no ${seqNo}'`)
      return null
    }

    const schema = response.result.data?.txn.data as SchemaType

    const schemaId = getLegacySchemaId(did, schema.data.name, schema.data.version)

    return {
      schema: {
        schemaId,
        attr_name: schema.data.attr_names,
        name: schema.data.name,
        version: schema.data.version,
        issuerId: did,
        seqNo,
      },
      indyNamespace: pool.indyNamespace,
    }
  }
}

interface SchemaType {
  data: {
    attr_names: string[]
    version: string
    name: string
  }
}
