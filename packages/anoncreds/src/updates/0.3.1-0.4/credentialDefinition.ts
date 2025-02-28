import type { BaseAgent } from '@credo-ts/core'
import type { AnonCredsCredentialDefinition } from '../../models'

import { CredoError } from '@credo-ts/core'

import { AnonCredsCredentialDefinitionRepository } from '../../repository'
import { AnonCredsRegistryService } from '../../services/registry/AnonCredsRegistryService'

/**
 * Migrates the {@link AnonCredsCredentialDefinitionRecord} to 0.4 compatible format. It fetches all credential definition records from
 * storage and updates the format based on the new ledger agnostic anoncreds models. After a record has been transformed,
 * it is updated in storage and the next record will be transformed.
 */
export async function migrateAnonCredsCredentialDefinitionRecordToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating AnonCredsCredentialDefinitionRecord records to storage version 0.4')
  const credentialDefinitionRepository = agent.dependencyManager.resolve(AnonCredsCredentialDefinitionRepository)

  agent.config.logger.debug('Fetching all credential definition records from storage')
  const credentialDefinitionRecords = await credentialDefinitionRepository.getAll(agent.context)

  agent.config.logger.debug(
    `Found a total of ${credentialDefinitionRecords.length} credential definition records to update.`
  )

  for (const credentialDefinitionRecord of credentialDefinitionRecords) {
    const oldCredentialDefinition =
      credentialDefinitionRecord.credentialDefinition as unknown as OldCredentialDefinition

    // If askar migration script is ran, it could be that the credential definition record is already in 0.4 format
    if (oldCredentialDefinition.id === undefined) {
      agent.config.logger.info(
        `Credential definition record with id ${credentialDefinitionRecord.id} and credential definition id ${credentialDefinitionRecord.credentialDefinitionId} is already in storage version 0.4 format. Probably due to Indy SDK to Askar migration. Skipping...`
      )
      continue
    }

    agent.config.logger.debug(
      `Migrating anoncreds credential definition record with id ${credentialDefinitionRecord.id} and credential definition id ${oldCredentialDefinition.id} to storage version 0.4`
    )

    // the schemaId is actually the ledger seqNo. We'll have to fetch the schema from the ledger to get the schemaId
    // However, we can't just fetch the schema by it's seqNo, so we'll actually fetch the credential definition,
    // which will contain the valid schemaId
    const registryService = agent.dependencyManager.resolve(AnonCredsRegistryService)
    const registry = registryService.getRegistryForIdentifier(agent.context, oldCredentialDefinition.id)
    agent.config.logger.debug(
      `Using registry with supportedIdentifier ${registry.supportedIdentifier} to resolve credential definition`
    )

    const { credentialDefinition } = await registry.getCredentialDefinition(agent.context, oldCredentialDefinition.id)
    if (!credentialDefinition) {
      agent.config.logger.error(
        `Could not resolve credential definition with id ${oldCredentialDefinition.id} from ledger`
      )
      throw new CredoError(`Unable to resolve credential definition ${oldCredentialDefinition.id}`)
    }

    agent.config.logger.debug(`Resolved credential definition with id ${oldCredentialDefinition.id} from ledger`, {
      credentialDefinition,
    })

    const newCredentialDefinition = {
      // Use the schemaId from the resolved credential definition so we get the qualified identifier
      schemaId: credentialDefinition.schemaId,
      tag: oldCredentialDefinition.tag,
      type: oldCredentialDefinition.type,
      value: oldCredentialDefinition.value,
      issuerId: oldCredentialDefinition.id.split('/')[0],
    } satisfies AnonCredsCredentialDefinition

    credentialDefinitionRecord.credentialDefinition = newCredentialDefinition
    credentialDefinitionRecord.credentialDefinitionId = oldCredentialDefinition.id
    credentialDefinitionRecord.methodName = 'indy'

    // Save updated credentialDefinition record
    await credentialDefinitionRepository.update(agent.context, credentialDefinitionRecord)

    agent.config.logger.debug(
      `Successfully migrated credential definition record with id ${credentialDefinitionRecord.id} to storage version 0.4`
    )
  }
}

export interface OldCredentialDefinition {
  id: string
  schemaId: string
  type: 'CL'
  tag: string
  value: {
    primary: Record<string, unknown>
    revocation?: unknown | undefined
  }
  ver: string
}
