import type { Agent } from '../../../../agent/Agent'
import type { CredentialMetadata, CredentialRecord } from '../../../../modules/credentials'

import { CredentialMetadataKeys } from '../../../../modules/credentials'
import { CredentialRepository } from '../../../../modules/credentials/repository/CredentialRepository'
import { Metadata } from '../../../Metadata'

/**
 * Migrates the {@link CredentialRecord} to 0.2 compatible format. It fetches all records from storage
 * and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link updateIndyMetadata}
 */
export async function migrateCredentialRecordToV0_2(agent: Agent) {
  agent.config.logger.info('Migrating credential records to storage version 0.2')
  const credentialRepository = agent.injectionContainer.resolve(CredentialRepository)

  agent.config.logger.debug(`Fetching all credential record from storage`)
  const allCredentials = await credentialRepository.getAll()

  agent.config.logger.debug(`Found a total of ${allCredentials} credential records to update.`)
  for (const credentialRecord of allCredentials) {
    agent.config.logger.debug(`Migrating credential record with id ${credentialRecord.id} to storage version 0.2`)

    await updateIndyMetadata(agent, credentialRecord)

    await credentialRepository.update(credentialRecord)

    agent.config.logger.debug(
      `Successfully migrated credential record with id ${credentialRecord.id} to storage version 0.2`
    )
  }
}

/**
 * The credential record had a custom `metadata` property in pre-0.1.0 storage that contained the `requestMetadata`, `schemaId` and `credentialDefinition`
 * properties. Later a generic metadata API was added that only allows objects to be stored. Therefore the properties were moved into a different structure.
 *
 * This migration method updates the top level properties to the new nested metadata structure.
 *
 * The following pre-0.1.0 structure:
 *
 * ```json
 * {
 *   "requestMetadata": "<value of requestMetadata>",
 *   "schemaId": "<value of schemaId>",
 *   "credentialDefinitionId": "<value of credential definition id>"
 * }
 * ```
 *
 * Will be transformed into the following 0.2.0 structure:
 *
 * ```json
 * {
 *   "_internal/indyRequest": <value of requestMetadata>,
 *   "_internal/indyCredential": {
 *     "schemaId": "<value of schemaId>",
 *     "credentialDefinitionId": "<value of credential definition id>"
 *   }
 * }
 * ```
 */
export async function updateIndyMetadata(agent: Agent, credentialRecord: CredentialRecord) {
  agent.config.logger.debug(`Updating indy metadata to use the generic metadata api available to records.`)

  const { requestMetadata, schemaId, credentialDefinitionId, ...rest } = credentialRecord.metadata.data
  const metadata = new Metadata<CredentialMetadata>(rest)

  if (requestMetadata) {
    agent.config.logger.trace(
      `Found top-level 'requestMetadata' key, moving to '${CredentialMetadataKeys.IndyRequest}'`
    )
    metadata.add(CredentialMetadataKeys.IndyRequest, { ...requestMetadata })
  }

  if (schemaId && typeof schemaId === 'string') {
    agent.config.logger.trace(
      `Found top-level 'schemaId' key, moving to '${CredentialMetadataKeys.IndyCredential}.schemaId'`
    )
    metadata.add(CredentialMetadataKeys.IndyCredential, { schemaId })
  }

  if (credentialDefinitionId && typeof credentialDefinitionId === 'string') {
    agent.config.logger.trace(
      `Found top-level 'credentialDefinitionId' key, moving to '${CredentialMetadataKeys.IndyCredential}.credentialDefinitionId'`
    )
    metadata.add(CredentialMetadataKeys.IndyCredential, { credentialDefinitionId })
  }

  credentialRecord.metadata = metadata
}
