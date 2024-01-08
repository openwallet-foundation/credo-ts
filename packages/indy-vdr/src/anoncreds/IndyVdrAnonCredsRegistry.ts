import {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetSchemaReturn,
  RegisterSchemaReturn,
  RegisterCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  AnonCredsRevocationRegistryDefinition,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
  AnonCredsSchema,
  AnonCredsCredentialDefinition,
  RegisterSchemaReturnStateFailed,
  RegisterSchemaReturnStateFinished,
  RegisterSchemaReturnStateAction,
  RegisterSchemaReturnStateWait,
  RegisterCredentialDefinitionReturnStateAction,
  RegisterCredentialDefinitionReturnStateWait,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterCredentialDefinitionReturnStateFailed,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
  RegisterRevocationRegistryDefinitionReturnStateFailed,
  RegisterRevocationRegistryDefinitionReturnStateWait,
  RegisterRevocationRegistryDefinitionReturnStateAction,
  AnonCredsRevocationStatusList,
  RegisterRevocationStatusListReturnStateFinished,
  RegisterRevocationStatusListReturnStateFailed,
  RegisterRevocationStatusListReturnStateWait,
  RegisterRevocationStatusListReturnStateAction,
  getUnqualifiedRevocationRegistryEntryId,
  unqualifiedIndyDidRegex,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { SchemaResponse } from '@hyperledger/indy-vdr-shared'

import {
  getUnqualifiedCredentialDefinitionId,
  getUnqualifiedRevocationRegistryDefinitionId,
  getUnqualifiedSchemaId,
  parseIndyCredentialDefinitionId,
  parseIndyDid,
  parseIndyRevocationRegistryId,
  parseIndySchemaId,
} from '@aries-framework/anoncreds'
import {
  RevocationRegistryEntryRequest,
  RevocationRegistryDefinitionRequest,
  GetSchemaRequest,
  SchemaRequest,
  GetCredentialDefinitionRequest,
  CredentialDefinitionRequest,
  GetTransactionRequest,
  GetRevocationRegistryDeltaRequest,
  GetRevocationRegistryDefinitionRequest,
  CustomRequest,
} from '@hyperledger/indy-vdr-shared'

import { verificationKeyForIndyDid } from '../dids/didIndyUtil'
import { IndyVdrPoolService } from '../pool'
import { multiSignRequest } from '../utils/sign'

import {
  indyVdrAnonCredsRegistryIdentifierRegex,
  getDidIndySchemaId,
  getDidIndyCredentialDefinitionId,
  getDidIndyRevocationRegistryDefinitionId,
  getDidIndyRevocationRegistryEntryId,
} from './utils/identifiers'
import { anonCredsRevocationStatusListFromIndyVdr } from './utils/transform'

export class IndyVdrAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'indy'

  public readonly supportedIdentifier = indyVdrAnonCredsRegistryIdentifierRegex

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      // parse schema id (supports did:indy and legacy)
      const { did, namespaceIdentifier, schemaName, schemaVersion } = parseIndySchemaId(schemaId)
      const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, did)
      agentContext.config.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.indyNamespace}'`)

      // even though we support did:indy and legacy identifiers we always need to fetch using the legacy identifier
      const legacySchemaId = getUnqualifiedSchemaId(namespaceIdentifier, schemaName, schemaVersion)
      const request = new GetSchemaRequest({ schemaId: legacySchemaId })

      agentContext.config.logger.trace(
        `Submitting get schema request for schema '${schemaId}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitRequest(request)

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
    options: IndyVdrRegisterSchema
  ): Promise<IndyVdrRegisterSchemaReturn> {
    const schema = options.schema
    const { issuerId, name, version, attrNames } = schema
    try {
      // This will throw an error if trying to register a schema with a legacy indy identifier. We only support did:indy identifiers
      // for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.

      const { namespaceIdentifier, namespace } = parseIndyDid(issuerId)
      const { endorserDid, endorserMode } = options.options
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const pool = indyVdrPoolService.getPoolForNamespace(namespace)

      let writeRequest: CustomRequest
      const didIndySchemaId = getDidIndySchemaId(namespace, namespaceIdentifier, schema.name, schema.version)

      const endorsedTransaction = options.options.endorsedTransaction
      if (endorsedTransaction) {
        agentContext.config.logger.debug(
          `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${issuerId}'`,
          schema
        )
        writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
      } else {
        agentContext.config.logger.debug(`Create schema tx on ledger '${namespace}' with did '${issuerId}'`, schema)
        const legacySchemaId = getUnqualifiedSchemaId(namespaceIdentifier, name, version)

        const schemaRequest = new SchemaRequest({
          submitterDid: namespaceIdentifier,
          schema: { id: legacySchemaId, name, ver: '1.0', version, attrNames },
        })

        const submitterKey = await verificationKeyForIndyDid(agentContext, issuerId)
        writeRequest = await pool.prepareWriteRequest(
          agentContext,
          schemaRequest,
          submitterKey,
          endorserDid !== issuerId ? endorserDid : undefined
        )

        if (endorserMode === 'external') {
          return {
            jobId: didIndySchemaId,
            schemaState: {
              state: 'action',
              action: 'endorseIndyTransaction',
              schemaId: didIndySchemaId,
              schema: schema,
              schemaRequest: writeRequest.body,
            },
            registrationMetadata: {},
            schemaMetadata: {},
          }
        }

        if (endorserMode === 'internal' && endorserDid !== issuerId) {
          const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
          await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
        }
      }
      const response = await pool.submitRequest(writeRequest)

      agentContext.config.logger.debug(`Registered schema '${didIndySchemaId}' on ledger '${pool.indyNamespace}'`, {
        response,
        writeRequest,
      })

      return {
        schemaState: {
          state: 'finished',
          schema: schema,
          schemaId: didIndySchemaId,
        },
        registrationMetadata: {},
        schemaMetadata: {
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          // Cast to SchemaResponse to pass type check
          indyLedgerSeqNo: (response as SchemaResponse)?.result?.txnMetadata?.seqNo,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error registering schema for did '${issuerId}'`, {
        error,
        did: issuerId,
        schema: schema,
      })

      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: schema,
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
      const { did, namespaceIdentifier, schemaSeqNo, tag } = parseIndyCredentialDefinitionId(credentialDefinitionId)
      const { pool } = await indyVdrPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Getting credential definition '${credentialDefinitionId}' from ledger '${pool.indyNamespace}'`
      )

      const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, tag)
      const request = new GetCredentialDefinitionRequest({
        credentialDefinitionId: legacyCredentialDefinitionId,
      })

      agentContext.config.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to ledger '${pool.indyNamespace}'`
      )
      const response = await pool.submitRequest(request)

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
    options: IndyVdrRegisterCredentialDefinition
  ): Promise<IndyVdrRegisterCredentialDefinitionReturn> {
    const credentialDefinition = options.credentialDefinition
    const { schemaId, issuerId, tag, value } = credentialDefinition

    try {
      // This will throw an error if trying to register a credential definition with a legacy indy identifier. We only support did:indy
      // identifiers for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.
      const { namespaceIdentifier, namespace } = parseIndyDid(issuerId)
      const { endorserDid, endorserMode } = options.options
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)
      const pool = indyVdrPoolService.getPoolForNamespace(namespace)

      agentContext.config.logger.debug(
        `Registering credential definition on ledger '${namespace}' with did '${issuerId}'`,
        options.credentialDefinition
      )

      let writeRequest: CustomRequest
      let didIndyCredentialDefinitionId: string
      let schemaSeqNo: number

      const endorsedTransaction = options.options.endorsedTransaction
      if (endorsedTransaction) {
        agentContext.config.logger.debug(
          `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${issuerId}'`,
          credentialDefinition
        )
        writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
        const operation = JSON.parse(endorsedTransaction)?.operation
        // extract the seqNo from the endorsed transaction, which is contained in the ref field of the operation
        schemaSeqNo = Number(operation?.ref)
        didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
          namespace,
          namespaceIdentifier,
          schemaSeqNo,
          tag
        )
      } else {
        // TODO: this will bypass caching if done on a higher level.
        const { schemaMetadata, resolutionMetadata } = await this.getSchema(agentContext, schemaId)

        if (!schemaMetadata?.indyLedgerSeqNo || typeof schemaMetadata.indyLedgerSeqNo !== 'number') {
          return {
            registrationMetadata: {},
            credentialDefinitionMetadata: {
              didIndyNamespace: pool.indyNamespace,
            },
            credentialDefinitionState: {
              credentialDefinition: options.credentialDefinition,
              state: 'failed',
              reason: `error resolving schema with id ${schemaId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
            },
          }
        }
        schemaSeqNo = schemaMetadata.indyLedgerSeqNo

        const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(issuerId, schemaSeqNo, tag)
        didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
          namespace,
          namespaceIdentifier,
          schemaSeqNo,
          tag
        )

        const credentialDefinitionRequest = new CredentialDefinitionRequest({
          submitterDid: namespaceIdentifier,
          credentialDefinition: {
            ver: '1.0',
            id: legacyCredentialDefinitionId,
            schemaId: schemaSeqNo.toString(),
            type: 'CL',
            tag: tag,
            value: value,
          },
        })

        const submitterKey = await verificationKeyForIndyDid(agentContext, issuerId)
        writeRequest = await pool.prepareWriteRequest(
          agentContext,
          credentialDefinitionRequest,
          submitterKey,
          endorserDid !== issuerId ? endorserDid : undefined
        )

        if (endorserMode === 'external') {
          return {
            jobId: didIndyCredentialDefinitionId,
            credentialDefinitionState: {
              state: 'action',
              action: 'endorseIndyTransaction',
              credentialDefinition: credentialDefinition,
              credentialDefinitionId: didIndyCredentialDefinitionId,
              credentialDefinitionRequest: writeRequest.body,
            },
            registrationMetadata: {},
            credentialDefinitionMetadata: {},
          }
        }

        if (endorserMode === 'internal' && endorserDid !== issuerId) {
          const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
          await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
        }
      }

      const response = await pool.submitRequest(writeRequest)
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
          credentialDefinition: credentialDefinition,
          credentialDefinitionId: didIndyCredentialDefinitionId,
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(`Error registering credential definition for schema '${schemaId}'`, {
        error,
        did: issuerId,
        credentialDefinition: options.credentialDefinition,
      })

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
        parseIndyRevocationRegistryId(revocationRegistryDefinitionId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.indyNamespace}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
      )

      const legacyRevocationRegistryId = getUnqualifiedRevocationRegistryDefinitionId(
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
      const response = await pool.submitRequest(request)

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
        : getUnqualifiedCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, credentialDefinitionTag)

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

  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    { options, revocationRegistryDefinition }: IndyVdrRegisterRevocationRegistryDefinition
  ): Promise<IndyVdrRegisterRevocationRegistryDefinitionReturn> {
    try {
      // This will throw an error if trying to register a credential definition with a legacy indy identifier. We only support did:indy
      // identifiers for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.
      const { namespaceIdentifier, namespace } = parseIndyDid(revocationRegistryDefinition.issuerId)
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)
      const pool = indyVdrPoolService.getPoolForNamespace(namespace)

      agentContext.config.logger.debug(
        `Registering revocation registry definition on ledger '${namespace}' with did '${revocationRegistryDefinition.issuerId}'`,
        revocationRegistryDefinition
      )

      let writeRequest: CustomRequest
      let didIndyRevocationRegistryDefinitionId: string
      let schemaSeqNo: number

      // TODO: this will bypass caching if done on a higher level.
      const { credentialDefinition, resolutionMetadata } = await this.getCredentialDefinition(
        agentContext,
        revocationRegistryDefinition.credDefId
      )

      if (!credentialDefinition) {
        return {
          registrationMetadata: {},
          revocationRegistryDefinitionMetadata: {
            didIndyNamespace: pool.indyNamespace,
          },
          revocationRegistryDefinitionState: {
            state: 'failed',
            reason: `error resolving credential definition with id ${revocationRegistryDefinition.credDefId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
        }
      }

      const { endorsedTransaction, endorserDid, endorserMode } = options
      if (endorsedTransaction) {
        agentContext.config.logger.debug(
          `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${revocationRegistryDefinition.issuerId}'`,
          revocationRegistryDefinition
        )
        writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
        const operation = JSON.parse(endorsedTransaction)?.operation
        // extract the seqNo from the endorsed transaction, which is contained in the ref field of the operation
        schemaSeqNo = Number(operation?.ref)
        didIndyRevocationRegistryDefinitionId = getDidIndyRevocationRegistryDefinitionId(
          namespace,
          namespaceIdentifier,
          schemaSeqNo,
          credentialDefinition.tag,
          revocationRegistryDefinition.tag
        )
      } else {
        const { schemaMetadata } = await this.getSchema(agentContext, credentialDefinition.schemaId)

        if (!schemaMetadata?.indyLedgerSeqNo || typeof schemaMetadata.indyLedgerSeqNo !== 'number') {
          return {
            registrationMetadata: {},
            revocationRegistryDefinitionMetadata: {
              didIndyNamespace: pool.indyNamespace,
            },
            revocationRegistryDefinitionState: {
              revocationRegistryDefinition,
              state: 'failed',
              reason: `error resolving schema with id ${credentialDefinition.schemaId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
            },
          }
        }
        schemaSeqNo = schemaMetadata.indyLedgerSeqNo

        const legacyRevocationRegistryDefinitionId = getUnqualifiedRevocationRegistryDefinitionId(
          namespaceIdentifier,
          schemaSeqNo,
          credentialDefinition.tag,
          revocationRegistryDefinition.tag
        )

        didIndyRevocationRegistryDefinitionId = getDidIndyRevocationRegistryDefinitionId(
          namespace,
          namespaceIdentifier,
          schemaSeqNo,
          credentialDefinition.tag,
          revocationRegistryDefinition.tag
        )

        const revocationRegistryDefinitionRequest = new RevocationRegistryDefinitionRequest({
          submitterDid: namespaceIdentifier,
          revocationRegistryDefinitionV1: {
            id: legacyRevocationRegistryDefinitionId,
            ver: '1.0',
            credDefId: revocationRegistryDefinition.credDefId,
            tag: revocationRegistryDefinition.tag,
            revocDefType: revocationRegistryDefinition.revocDefType,
            value: {
              tailsHash: revocationRegistryDefinition.value.tailsHash,
              maxCredNum: revocationRegistryDefinition.value.maxCredNum,
              publicKeys: revocationRegistryDefinition.value.publicKeys,
              issuanceType: 'ISSUANCE_BY_DEFAULT',
              tailsLocation: revocationRegistryDefinition.value.tailsLocation,
            },
          },
        })

        const submitterKey = await verificationKeyForIndyDid(agentContext, revocationRegistryDefinition.issuerId)
        writeRequest = await pool.prepareWriteRequest(
          agentContext,
          revocationRegistryDefinitionRequest,
          submitterKey,
          endorserDid !== revocationRegistryDefinition.issuerId ? endorserDid : undefined
        )

        if (endorserMode === 'external') {
          return {
            jobId: didIndyRevocationRegistryDefinitionId,
            revocationRegistryDefinitionState: {
              state: 'action',
              action: 'endorseIndyTransaction',
              revocationRegistryDefinition,
              revocationRegistryDefinitionId: didIndyRevocationRegistryDefinitionId,
              revocationRegistryDefinitionRequest: writeRequest.body,
            },
            registrationMetadata: {},
            revocationRegistryDefinitionMetadata: {},
          }
        }

        if (endorserMode === 'internal' && endorserDid !== revocationRegistryDefinition.issuerId) {
          const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
          await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
        }
      }

      const response = await pool.submitRequest(writeRequest)
      agentContext.config.logger.debug(
        `Registered revocation registry definition '${didIndyRevocationRegistryDefinitionId}' on ledger '${pool.indyNamespace}'`,
        {
          response,
          revocationRegistryDefinition,
        }
      )

      return {
        revocationRegistryDefinitionMetadata: {},
        revocationRegistryDefinitionState: {
          revocationRegistryDefinition,
          revocationRegistryDefinitionId: didIndyRevocationRegistryDefinitionId,
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation registry definition for credential definition '${revocationRegistryDefinition.credDefId}'`,
        {
          error,
          did: revocationRegistryDefinition.issuerId,
          revocationRegistryDefinition,
        }
      )

      return {
        revocationRegistryDefinitionMetadata: {},
        registrationMetadata: {},
        revocationRegistryDefinitionState: {
          revocationRegistryDefinition,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
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
      const indySdkPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
        parseIndyRevocationRegistryId(revocationRegistryId)
      const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      agentContext.config.logger.debug(
        `Using ledger '${pool.indyNamespace}' to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryId}' until ${timestamp}`
      )

      const legacyRevocationRegistryId = getUnqualifiedRevocationRegistryDefinitionId(
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
      const response = await pool.submitRequest(request)

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

  public async registerRevocationStatusList(
    agentContext: AgentContext,
    { options, revocationStatusList }: IndyVdrRegisterRevocationStatusList
  ): Promise<RegisterRevocationStatusListReturn> {
    try {
      // This will throw an error if trying to register a credential definition with a legacy indy identifier. We only support did:indy
      // identifiers for registering, that will allow us to extract the namespace and means all stored records will use did:indy identifiers.
      const { namespaceIdentifier, namespace } = parseIndyDid(revocationStatusList.issuerId)
      const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)
      const pool = indyVdrPoolService.getPoolForNamespace(namespace)

      agentContext.config.logger.debug(
        `Registering revocation status list on ledger '${namespace}' with did '${revocationStatusList.issuerId}'`,
        revocationStatusList
      )

      let writeRequest: CustomRequest

      const { revocationRegistryDefinition } = await this.getRevocationRegistryDefinition(
        agentContext,
        revocationStatusList.revRegDefId
      )

      if (!revocationRegistryDefinition) {
        return {
          registrationMetadata: {},
          revocationStatusListMetadata: {},
          revocationStatusListState: {
            revocationStatusList,
            state: 'failed',
            reason: `Unable to resolve revocation registry definition '${revocationStatusList.revRegDefId}'`,
          },
        }
      }

      const { credentialDefinition } = await this.getCredentialDefinition(
        agentContext,
        revocationRegistryDefinition.credDefId
      )

      if (!credentialDefinition) {
        return {
          registrationMetadata: {},
          revocationStatusListMetadata: {},
          revocationStatusListState: {
            revocationStatusList,
            state: 'failed',
            reason: `Unable to resolve credential definition '${revocationRegistryDefinition.credDefId}'`,
          },
        }
      }

      const { schemaMetadata } = await this.getSchema(agentContext, credentialDefinition.schemaId)

      if (!schemaMetadata?.indyLedgerSeqNo || typeof schemaMetadata.indyLedgerSeqNo !== 'number') {
        return {
          registrationMetadata: {},
          revocationStatusListMetadata: {},
          revocationStatusListState: {
            revocationStatusList,
            state: 'failed',
            reason: `Unable to resolve schema '${credentialDefinition.schemaId}'`,
          },
        }
      }

      const schemaSeqNo = Number(schemaMetadata.indyLegderSeqNo)
      const didIndyRevocationRegistryEntryId = getDidIndyRevocationRegistryEntryId(
        namespace,
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinition.tag,
        revocationRegistryDefinition.tag
      )

      const { endorsedTransaction, endorserDid, endorserMode } = options
      if (endorsedTransaction) {
        agentContext.config.logger.debug(
          `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${revocationStatusList.issuerId}'`,
          revocationStatusList
        )
        writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
        // extract the seqNo from the endorsed transaction, which is contained in the ref field of the operation
      } else {
        const revocationRegistryDefinitionRequest = new RevocationRegistryEntryRequest({
          submitterDid: namespaceIdentifier,
          revocationRegistryEntry: {
            ver: '1.0',
            value: {
              accum: revocationStatusList.currentAccumulator,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              issued: revocationStatusList.issued ?? [],
              revoked: revocationStatusList.revoked ?? [],
            },
          },
          revocationRegistryDefinitionType: 'CL_ACCUM',
          revocationRegistryDefinitionId: revocationStatusList.revRegDefId,
        })

        const submitterKey = await verificationKeyForIndyDid(agentContext, revocationStatusList.issuerId)
        writeRequest = await pool.prepareWriteRequest(
          agentContext,
          revocationRegistryDefinitionRequest,
          submitterKey,
          endorserDid !== revocationStatusList.issuerId ? endorserDid : undefined
        )

        if (endorserMode === 'external') {
          return {
            jobId: didIndyRevocationRegistryEntryId,
            revocationStatusListState: {
              state: 'action',
              action: 'endorseIndyTransaction',
              revocationStatusList,
              timestamp: revocationStatusList.timestamp.toString(),
            },
            registrationMetadata: {},
            revocationStatusListMetadata: {},
          }
        }

        if (endorserMode === 'internal' && endorserDid !== revocationStatusList.issuerId) {
          const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
          await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
        }
      }

      const response = await pool.submitRequest(writeRequest)
      agentContext.config.logger.debug(
        `Registered revocation status list '${didIndyRevocationRegistryEntryId}' on ledger '${pool.indyNamespace}'`,
        {
          response,
          revocationStatusList,
        }
      )

      return {
        revocationStatusListMetadata: {},
        revocationStatusListState: {
          revocationStatusList,
          timestamp: revocationStatusList.timestamp.toString(),
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation status list for revocation status list '${getDidIndyRevocationRegistryEntryId}'`,
        {
          error,
          did: revocationStatusList.issuerId,
        }
      )

      return {
        registrationMetadata: {},
        revocationStatusListMetadata: {},
        revocationStatusListState: {
          revocationStatusList,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
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
    const response = await pool.submitRequest(request)

    if (response.result.data?.txn.type !== '101') {
      agentContext.config.logger.error(`Could not get schema from ledger for seq no ${seqNo}'`)
      return null
    }

    const schema = response.result.data?.txn.data as SchemaType

    const schemaId = getUnqualifiedSchemaId(did, schema.data.name, schema.data.version)

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

type InternalEndorsement = { endorserMode: 'internal'; endorserDid: string; endorsedTransaction?: never }
type ExternalEndorsementCreate = { endorserMode: 'external'; endorserDid: string; endorsedTransaction?: never }
type ExternalEndorsementSubmit = { endorserMode: 'external'; endorserDid?: never; endorsedTransaction: string }

export interface IndyVdrRegisterSchemaInternalOptions {
  schema: AnonCredsSchema
  options: InternalEndorsement
}

export interface IndyVdrRegisterSchemaExternalCreateOptions {
  schema: AnonCredsSchema
  options: ExternalEndorsementCreate
}

export interface IndyVdrRegisterSchemaExternalSubmitOptions {
  schema: AnonCredsSchema
  options: ExternalEndorsementSubmit
}

export interface IndyVdrRegisterSchemaReturnStateAction extends RegisterSchemaReturnStateAction {
  action: 'endorseIndyTransaction'
  schemaRequest: string
}

export interface IndyVdrRegisterSchemaReturn extends RegisterSchemaReturn {
  schemaState:
    | RegisterSchemaReturnStateWait
    | IndyVdrRegisterSchemaReturnStateAction
    | RegisterSchemaReturnStateFinished
    | RegisterSchemaReturnStateFailed
}

export type IndyVdrRegisterSchema =
  | IndyVdrRegisterSchemaInternalOptions
  | IndyVdrRegisterSchemaExternalCreateOptions
  | IndyVdrRegisterSchemaExternalSubmitOptions

export type IndyVdrRegisterSchemaOptions = IndyVdrRegisterSchema['options']

export interface IndyVdrRegisterCredentialDefinitionInternalOptions {
  credentialDefinition: AnonCredsCredentialDefinition
  options: InternalEndorsement
}

export interface IndyVdrRegisterCredentialDefinitionExternalCreateOptions {
  credentialDefinition: AnonCredsCredentialDefinition
  options: ExternalEndorsementCreate
}

export interface IndyVdrRegisterCredentialDefinitionExternalSubmitOptions {
  credentialDefinition: AnonCredsCredentialDefinition
  options: ExternalEndorsementSubmit
}

export interface IndyVdrRegisterCredentialDefinitionReturnStateAction
  extends RegisterCredentialDefinitionReturnStateAction {
  action: 'endorseIndyTransaction'
  credentialDefinitionRequest: string
}

export interface IndyVdrRegisterCredentialDefinitionReturn extends RegisterCredentialDefinitionReturn {
  credentialDefinitionState:
    | RegisterCredentialDefinitionReturnStateWait
    | IndyVdrRegisterCredentialDefinitionReturnStateAction
    | RegisterCredentialDefinitionReturnStateFinished
    | RegisterCredentialDefinitionReturnStateFailed
}

export type IndyVdrRegisterCredentialDefinition =
  | IndyVdrRegisterCredentialDefinitionInternalOptions
  | IndyVdrRegisterCredentialDefinitionExternalCreateOptions
  | IndyVdrRegisterCredentialDefinitionExternalSubmitOptions

export type IndyVdrRegisterCredentialDefinitionOptions = IndyVdrRegisterCredentialDefinition['options']

export interface IndyVdrRegisterRevocationRegistryDefinitionInternalOptions {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  options: InternalEndorsement
}

export interface IndyVdrRegisterRevocationRegistryDefinitionExternalCreateOptions {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  options: ExternalEndorsementCreate
}

export interface IndyVdrRegisterRevocationRegistryDefinitionExternalSubmitOptions {
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
  options: ExternalEndorsementSubmit
}

export interface IndyVdrRegisterRevocationRegistryDefinitionReturnStateAction
  extends RegisterRevocationRegistryDefinitionReturnStateAction {
  action: 'endorseIndyTransaction'
  revocationRegistryDefinitionRequest: string
}

export interface IndyVdrRegisterRevocationRegistryDefinitionReturn extends RegisterRevocationRegistryDefinitionReturn {
  revocationRegistryDefinitionState:
    | IndyVdrRegisterRevocationRegistryDefinitionReturnStateAction
    | RegisterRevocationRegistryDefinitionReturnStateWait
    | RegisterRevocationRegistryDefinitionReturnStateFinished
    | RegisterRevocationRegistryDefinitionReturnStateFailed
}

export type IndyVdrRegisterRevocationRegistryDefinition =
  | IndyVdrRegisterRevocationRegistryDefinitionInternalOptions
  | IndyVdrRegisterRevocationRegistryDefinitionExternalCreateOptions
  | IndyVdrRegisterRevocationRegistryDefinitionExternalSubmitOptions

export type IndyVdrRegisterRevocationRegistryDefinitionOptions = IndyVdrRegisterRevocationRegistryDefinition['options']

export interface IndyVdrRegisterRevocationStatusListInternalOptions {
  revocationStatusList: AnonCredsRevocationStatusList
  options: InternalEndorsement
}

export interface IndyVdrRegisterRevocationStatusListExternalCreateOptions {
  revocationStatusList: AnonCredsRevocationStatusList
  options: ExternalEndorsementCreate
}

export interface IndyVdrRegisterRevocationStatusListExternalSubmitOptions {
  revocationStatusList: AnonCredsRevocationStatusList
  options: ExternalEndorsementSubmit
}

export interface IndyVdrRegisterRevocationStatusListReturnStateAction
  extends RegisterRevocationStatusListReturnStateAction {
  action: 'endorseIndyTransaction'
  revocationStatusListRequest: string
}

export interface IndyVdrRegisterRevocationStatusListReturn extends RegisterRevocationStatusListReturn {
  revocationStatusListState:
    | IndyVdrRegisterRevocationStatusListReturnStateAction
    | RegisterRevocationStatusListReturnStateWait
    | RegisterRevocationStatusListReturnStateFinished
    | RegisterRevocationStatusListReturnStateFailed
}

export type IndyVdrRegisterRevocationStatusList =
  | IndyVdrRegisterRevocationStatusListInternalOptions
  | IndyVdrRegisterRevocationStatusListExternalCreateOptions
  | IndyVdrRegisterRevocationStatusListExternalSubmitOptions

export type IndyVdrRegisterRevocationStatusListOptions = IndyVdrRegisterRevocationStatusList['options']
