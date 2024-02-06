import type { AgentContext, BaseAgent } from '@credo-ts/core'

import { CacheModuleConfig, W3cCredentialService } from '@credo-ts/core'

import { AnonCredsCredentialRepository, type AnonCredsCredentialRecord } from '../../repository'
import { legacyCredentialToW3cCredential } from '../../utils'
import { getQualifiedId, fetchCredentialDefinition, getIndyNamespace } from '../../utils/ledgerObjects'

async function migrateLegacyToW3cCredential(agentContext: AgentContext, legacyRecord: AnonCredsCredentialRecord) {
  const legacyCredential = legacyRecord.credential
  const legacyTags = legacyRecord.getTags()

  let qualifiedCredentialDefinitionId: string | undefined
  let qualifiedIssuerId: string | undefined
  let namespace: string | undefined

  const cacheModuleConfig = agentContext.dependencyManager.resolve(CacheModuleConfig)
  const cache = cacheModuleConfig?.cache
  const indyCacheKey = `IndyVdrPoolService:${legacyTags.credentialDefinitionId}`
  const sovCacheKey = `IndySdkPoolService:${legacyTags.credentialDefinitionId}`

  const cachedNymResponse: Record<string, string> | null =
    (await cache.get(agentContext, indyCacheKey)) ?? (await cache.get(agentContext, sovCacheKey))

  namespace = cachedNymResponse?.indyNamespace

  if (!namespace) {
    try {
      const credentialDefinitionReturn = await fetchCredentialDefinition(
        agentContext,
        legacyTags.credentialDefinitionId
      )
      qualifiedCredentialDefinitionId = credentialDefinitionReturn.qualifiedId
      qualifiedIssuerId = credentialDefinitionReturn.qualifiedCredentialDefinition.issuerId
      namespace = getIndyNamespace(credentialDefinitionReturn.qualifiedId)
    } catch (e) {
      agentContext.config.logger.warn(
        [
          `Failed to fetch credential definition for credentialId ${legacyTags.credentialDefinitionId}.`,
          `Not updating credential with id ${legacyRecord.credentialId} to W3C format.`,
        ].join('\n')
      )
    }
  } else {
    qualifiedCredentialDefinitionId = getQualifiedId(legacyTags.credentialDefinitionId, namespace)
    qualifiedIssuerId = getQualifiedId(legacyTags.issuerId, namespace)
  }

  if (!qualifiedCredentialDefinitionId || !qualifiedIssuerId || !namespace) return

  const w3cJsonLdCredential = await legacyCredentialToW3cCredential(legacyCredential, qualifiedIssuerId)

  const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
  await w3cCredentialService.storeCredential(agentContext, {
    credential: w3cJsonLdCredential,
    anonCredsCredentialRecordOptions: {
      credentialId: legacyRecord.credentialId,
      linkSecretId: legacyRecord.linkSecretId,
      credentialDefinitionId: qualifiedCredentialDefinitionId,
      schemaId: getQualifiedId(legacyTags.schemaId, namespace),
      schemaName: legacyTags.schemaName,
      schemaIssuerId: getQualifiedId(legacyTags.issuerId, namespace),
      schemaVersion: legacyTags.schemaVersion,
      methodName: legacyRecord.methodName,
      revocationRegistryId: getQualifiedId(legacyTags.credentialDefinitionId, namespace),
      credentialRevocationId: legacyTags.credentialRevocationId,
    },
  })
}

/**
 * Stores all anoncreds credentials in the new w3c format
 */
export async function storeAnonCredsInW3cFormatV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migration of legacy AnonCreds records to the new W3C format version 0.5')

  const anoncredsRepository = agent.dependencyManager.resolve(AnonCredsCredentialRepository)

  agent.config.logger.debug(`Fetching all anoncreds credential records from storage`)
  const records = await anoncredsRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${records.length} legacy anonCreds credential records to update.`)

  for (const record of records) {
    agent.config.logger.debug(
      `Re-saving anonCreds credential record with id ${record.id} in the new w3c format, and deleting the legacy record`
    )
    await migrateLegacyToW3cCredential(agent.context, record)
    await anoncredsRepository.delete(agent.context, record)

    agent.config.logger.debug(`Successfully migrated w3c credential record with id ${record.id} to storage version 0.5`)
  }
}
