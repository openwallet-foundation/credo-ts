import type { AnonCredsCredentialRecord } from '../../repository'
import type { AgentContext, BaseAgent } from '@credo-ts/core'

import { W3cCredentialService } from '@credo-ts/core'

import { AnonCredsCredentialRepository } from '../../repository'
import { legacyCredentialToW3cCredential } from '../../utils'
import { getQualifiedId, fetchCredentialDefinition, getIndyNamespace } from '../../utils/ledgerObjects'

async function migrateLegacyToW3cCredential(agentContext: AgentContext, legacyRecord: AnonCredsCredentialRecord) {
  const legacyCredential = legacyRecord.credential
  const legacyTags = legacyRecord.getTags()

  // TODO: check if it is in cache
  const credentialDefinitionReturn = await fetchCredentialDefinition(agentContext, legacyTags.credentialDefinitionId)
  const namespace = getIndyNamespace(credentialDefinitionReturn.qualifiedId)

  const w3cJsonLdCredential = await legacyCredentialToW3cCredential(
    legacyCredential,
    credentialDefinitionReturn.qualifiedCredentialDefinition
  )

  const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
  await w3cCredentialService.storeCredential(agentContext, {
    credential: w3cJsonLdCredential,
    anonCredsCredentialRecordOptions: {
      credentialId: legacyRecord.credentialId,
      linkSecretId: legacyRecord.linkSecretId,
      credentialDefinitionId: credentialDefinitionReturn.qualifiedId,
      schemaId: getQualifiedId(legacyTags.schemaId, namespace),
      schemaName: legacyTags.schemaName,
      schemaIssuerId: getQualifiedId(legacyTags.issuerId, namespace),
      schemaVersion: legacyTags.schemaVersion,
      methodName: legacyRecord.methodName,
      revocationRegistryId: getQualifiedId(legacyTags.credentialDefinitionId, namespace),
      credentialRevocationId: legacyTags.credentialRevocationId,
    },
  })

  return w3cJsonLdCredential
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
