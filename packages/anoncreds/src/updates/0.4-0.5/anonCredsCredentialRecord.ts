import type { AgentContext, BaseAgent } from '@credo-ts/core'
import {
  CacheModuleConfig,
  CredoError,
  DidResolverService,
  W3cCredentialRecord,
  W3cCredentialService,
} from '@credo-ts/core'
import { DidCommCredentialExchangeRepository } from '@credo-ts/didcomm'
import { type AnonCredsCredentialRecord, AnonCredsCredentialRepository } from '../../repository'
import type { AnonCredsHolderService } from '../../services'
import { AnonCredsHolderServiceSymbol } from '../../services'
import { getIndyNamespaceFromIndyDid, isIndyDid } from '../../utils/indyIdentifiers'
import type { W3cAnonCredsCredentialMetadata } from '../../utils/metadata'
import { W3cAnonCredsCredentialMetadataKey } from '../../utils/metadata'
import { getW3cRecordAnonCredsTags } from '../../utils/w3cAnonCredsUtils'
import {
  getQualifiedDidIndyDid,
  getUnqualifiedIndyDidNamespaceIdentifier,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedIndyDid,
} from './unqualifiedIndyIdentifiers'

async function getIndyNamespace(agentContext: AgentContext, legacyIssuerId: string): Promise<string> {
  const cacheModuleConfig = agentContext.dependencyManager.resolve(CacheModuleConfig)
  const cache = cacheModuleConfig.cache

  const namespaceIdentifier = getUnqualifiedIndyDidNamespaceIdentifier(legacyIssuerId)
  const indyCacheKey = `IndyVdrPoolService:${namespaceIdentifier}`
  const sovCacheKey = `IndySdkPoolService:${namespaceIdentifier}`

  const getCachedIndyNamespace = async () => {
    const cachedNymResponse: Record<string, unknown> | null =
      (await cache.get(agentContext, indyCacheKey, { scope: 'global' })) ?? (await cache.get(agentContext, sovCacheKey))

    const indyNamespace = cachedNymResponse?.indyNamespace
    return typeof indyNamespace === 'string' ? indyNamespace : undefined
  }

  const cachedIndyNamespace = await getCachedIndyNamespace()
  if (cachedIndyNamespace) return cachedIndyNamespace

  // The indy-vdr pool service looks up the ledger of an unqualified did when it resolves the did:sov did,
  // and it writes the indy namespace to the cache. We resolve the did and then read the cache again.
  const didResolverService = agentContext.dependencyManager.resolve(DidResolverService)
  await didResolverService.resolve(agentContext, `did:sov:${namespaceIdentifier}`)

  const resolvedIndyNamespace = await getCachedIndyNamespace()
  if (resolvedIndyNamespace) return resolvedIndyNamespace

  throw new CredoError(
    `Could not determine the indy namespace of issuer '${legacyIssuerId}'. The indy namespace is required to store the anoncreds credential in the new w3c format.`
  )
}

async function migrateLegacyToW3cCredential(agentContext: AgentContext, legacyRecord: AnonCredsCredentialRecord) {
  const legacyTags = legacyRecord.getTags()

  let indyNamespace: string | undefined
  let qualifiedSchemaId: string
  let qualifiedSchemaIssuerId: string
  let qualifiedCredentialDefinitionId: string
  let qualifiedIssuerId: string
  let qualifiedRevocationRegistryId: string | undefined

  if (
    !isUnqualifiedCredentialDefinitionId(legacyTags.credentialDefinitionId) &&
    !isUnqualifiedIndyDid(legacyTags.issuerId)
  ) {
    if (isIndyDid(legacyTags.issuerId)) {
      indyNamespace = getIndyNamespaceFromIndyDid(legacyTags.issuerId)
    }
  } else {
    indyNamespace = await getIndyNamespace(agentContext, legacyTags.issuerId)
  }

  if (indyNamespace) {
    qualifiedCredentialDefinitionId = getQualifiedDidIndyDid(legacyTags.credentialDefinitionId, indyNamespace)
    qualifiedIssuerId = getQualifiedDidIndyDid(legacyTags.issuerId, indyNamespace)
    qualifiedRevocationRegistryId = legacyTags.revocationRegistryId
      ? getQualifiedDidIndyDid(legacyTags.revocationRegistryId, indyNamespace)
      : undefined
    qualifiedSchemaId = getQualifiedDidIndyDid(legacyTags.schemaId, indyNamespace)
    qualifiedSchemaIssuerId = getQualifiedDidIndyDid(legacyTags.schemaIssuerId, indyNamespace)
  } else {
    qualifiedCredentialDefinitionId = legacyTags.credentialDefinitionId
    qualifiedIssuerId = legacyTags.issuerId
    qualifiedRevocationRegistryId = legacyTags.revocationRegistryId
    qualifiedSchemaId = legacyTags.schemaId
    qualifiedSchemaIssuerId = legacyTags.schemaIssuerId
  }

  const anonCredsHolderService =
    agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
  const w3cJsonLdCredential = await anonCredsHolderService.legacyToW3cCredential(agentContext, {
    credential: legacyRecord.credential,
    issuerId: qualifiedIssuerId,
  })

  if (Array.isArray(w3cJsonLdCredential.credentialSubject)) {
    throw new CredoError('Credential subject must be an object, not an array.')
  }

  const anonCredsTags = getW3cRecordAnonCredsTags({
    credentialSubject: w3cJsonLdCredential.credentialSubject,
    issuerId: w3cJsonLdCredential.issuerId,
    schemaId: qualifiedSchemaId,
    schema: {
      issuerId: qualifiedSchemaIssuerId,
      name: legacyTags.schemaName,
      version: legacyTags.schemaVersion,
    },
    credentialRevocationId: legacyTags.credentialRevocationId,
    revocationRegistryId: qualifiedRevocationRegistryId,
    credentialDefinitionId: qualifiedCredentialDefinitionId,
    linkSecretId: legacyTags.linkSecretId,
    methodName: legacyTags.methodName,
  })

  const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
  const w3cCredentialRecord = new W3cCredentialRecord({
    credentialInstances: [
      {
        credential: w3cJsonLdCredential.encoded,
      },
    ],
    tags: {},
  })
  for (const [key, meta] of Object.entries(legacyRecord.metadata.data)) {
    w3cCredentialRecord.metadata.set(key, meta)
  }

  const anonCredsCredentialMetadata: W3cAnonCredsCredentialMetadata = {
    credentialRevocationId: anonCredsTags.anonCredsCredentialRevocationId,
    linkSecretId: anonCredsTags.anonCredsLinkSecretId,
    methodName: anonCredsTags.anonCredsMethodName,
  }

  w3cCredentialRecord.setTags(anonCredsTags)
  w3cCredentialRecord.metadata.set(W3cAnonCredsCredentialMetadataKey, anonCredsCredentialMetadata)

  await w3cCredentialService.storeCredential(agentContext, { record: w3cCredentialRecord })

  // Find the credential exchange record bound to this anoncreds credential and update it to point to the newly created w3c record
  const credentialExchangeRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
  const [relatedCredentialExchangeRecord] = await credentialExchangeRepository.findByQuery(agentContext, {
    credentialIds: [legacyRecord.credentialId],
  })

  if (relatedCredentialExchangeRecord) {
    // Replace the related binding by the new one
    const credentialBindingIndex = relatedCredentialExchangeRecord.credentials.findIndex(
      (binding) => binding.credentialRecordId === legacyRecord.credentialId
    )
    if (credentialBindingIndex !== -1) {
      relatedCredentialExchangeRecord.credentials[credentialBindingIndex] = {
        credentialRecordType: 'w3c',
        credentialRecordId: w3cCredentialRecord.id,
      }

      // Store the qualified revocation registry id, so the revocation notification service can find the record
      if (legacyTags.revocationRegistryId && indyNamespace) {
        relatedCredentialExchangeRecord.setTags({
          anonCredsRevocationRegistryId: getQualifiedDidIndyDid(legacyTags.revocationRegistryId, indyNamespace),
        })
      }

      await credentialExchangeRepository.update(agentContext, relatedCredentialExchangeRecord)
    }
  }
}

/**
 * Stores all anoncreds credentials in the new w3c format
 */
export async function storeAnonCredsInW3cFormatV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migration of legacy AnonCreds records to the new W3C format version 0.5')

  const anoncredsRepository = agent.dependencyManager.resolve(AnonCredsCredentialRepository)

  agent.config.logger.debug('Fetching all anoncreds credential records from storage')
  const records = await anoncredsRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${records.length} legacy anonCreds credential records to update.`)

  for (const record of records) {
    agent.config.logger.debug(
      `Re-saving anonCreds credential record with id ${record.id} in the new w3c format, and deleting the legacy record`
    )
    try {
      await migrateLegacyToW3cCredential(agent.context, record)
      await anoncredsRepository.delete(agent.context, record)
      agent.config.logger.debug(
        `Successfully migrated w3c credential record with id ${record.id} to storage version 0.5`
      )
    } catch (error) {
      agent.config.logger.error(
        `Failed to migrate w3c credential record with id ${record.id} to storage version 0.5`,
        error
      )
    }
  }
}
