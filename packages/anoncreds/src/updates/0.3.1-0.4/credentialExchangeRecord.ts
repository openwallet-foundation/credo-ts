import type { BaseAgent, CredentialExchangeRecord } from '@aries-framework/core'

import { CredentialRepository } from '@aries-framework/core'

/**
 * Migrates the {@link CredentialExchangeRecord} to 0.4 compatible format. It fetches all credential exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateIndyCredentialMetadataToAnonCredsMetadata}
 *  - {@link migrateIndyCredentialTypeToAnonCredsCredential}
 */
export async function migrateCredentialExchangeRecordToV0_4<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating credential exchange records to storage version 0.4')
  const credentialRepository = agent.dependencyManager.resolve(CredentialRepository)

  agent.config.logger.debug(`Fetching all credential records from storage`)
  const credentialRecords = await credentialRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${credentialRecords.length} credential exchange records to update.`)
  for (const credentialRecord of credentialRecords) {
    agent.config.logger.debug(
      `Migrating credential exchange record with id ${credentialRecord.id} to storage version 0.4`
    )

    migrateIndyCredentialTypeToAnonCredsCredential(agent, credentialRecord)
    migrateIndyCredentialMetadataToAnonCredsMetadata(agent, credentialRecord)

    // Save updated did record
    await credentialRepository.update(agent.context, credentialRecord)

    agent.config.logger.debug(
      `Successfully migrated credential exchange record with id ${credentialRecord.id} to storage version 0.4`
    )
  }
}

/**
 * Migrates the indy credential record binding to anoncreds credential record binding.
 *
 * The following 0.3.1 credential record structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "credentials": [
 *     {
 *       "credentialRecordId": "credential-id",
 *       "credentialRecordType": "indy"
 *     },
 *     {
 *       "credentialRecordId": "credential-id2",
 *       "credentialRecordType": "jsonld"
 *     }
 *   ]
 * }
 * ```
 *
 * Wil be tranformed into the following 0.4 credential record structure (unrelated keys omitted):
 * ```json
 * {
 *   "credentials": [
 *     {
 *       "credentialRecordId": "credential-id",
 *       "credentialRecordType": "anoncreds"
 *     },
 *     {
 *       "credentialRecordId": "credential-id2",
 *       "credentialRecordType": "jsonld"
 *     }
 *   ]
 * }
 * ```
 */
export function migrateIndyCredentialTypeToAnonCredsCredential<Agent extends BaseAgent>(
  agent: Agent,
  credentialRecord: CredentialExchangeRecord
) {
  agent.config.logger.debug(
    `Migrating credential record with id ${credentialRecord.id} to anoncreds credential binding for version 0.4`
  )

  const INDY_CREDENTIAL_RECORD_TYPE = 'indy'
  const ANONCREDS_CREDENTIAL_RECORD_TYPE = 'anoncreds'

  for (const credential of credentialRecord.credentials) {
    if (credential.credentialRecordType === INDY_CREDENTIAL_RECORD_TYPE) {
      agent.config.logger.debug(`Updating credential binding ${credential.credentialRecordId} to anoncreds type`)
      credential.credentialRecordType = ANONCREDS_CREDENTIAL_RECORD_TYPE
    }
  }

  agent.config.logger.debug(
    `Successfully migrated credential record with id ${credentialRecord.id} to anoncreds credential binding for version 0.4`
  )
}

/**
 * Migrates the indy credential metadata type to anoncreds credential metadata type.
 *
 * The following 0.3.1 credential metadata structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "_internal/indyRequest": {}
 *   "_internal/indyCredential": {}
 * }
 * ```
 *
 * Wil be tranformed into the following 0.4 credential metadata structure (unrelated keys omitted):
 * ```json
 * {
 *   "_anoncreds/credentialRequest": {}
 *   "_anoncreds/credential": {}
 * }
 * ```
 */
export function migrateIndyCredentialMetadataToAnonCredsMetadata<Agent extends BaseAgent>(
  agent: Agent,
  credentialRecord: CredentialExchangeRecord
) {
  agent.config.logger.debug(
    `Migrating credential record with id ${credentialRecord.id} to anoncreds metadata for version 0.4`
  )

  const indyCredentialRequestMetadataKey = '_internal/indyRequest'
  const indyCredentialMetadataKey = '_internal/indyCredential'

  const ANONCREDS_CREDENTIAL_REQUEST_METADATA = '_anoncreds/credentialRequest'
  const ANONCREDS_CREDENTIAL_METADATA = '_anoncreds/credential'

  const indyCredentialRequestMetadata = credentialRecord.metadata.get(indyCredentialRequestMetadataKey)
  if (indyCredentialRequestMetadata) {
    // TODO: we if we choose to rename master secret to link secret in anoncreds-rs we should also rename it in the request
    credentialRecord.metadata.set(ANONCREDS_CREDENTIAL_REQUEST_METADATA, indyCredentialRequestMetadata)
    credentialRecord.metadata.delete(indyCredentialRequestMetadataKey)
  }

  const indyCredentialMetadata = credentialRecord.metadata.get(indyCredentialMetadataKey)
  if (indyCredentialMetadata) {
    credentialRecord.metadata.set(ANONCREDS_CREDENTIAL_METADATA, indyCredentialMetadata)
    credentialRecord.metadata.delete(indyCredentialMetadataKey)
  }

  agent.config.logger.debug(
    `Successfully migrated credential record with id ${credentialRecord.id} to anoncreds credential metadata for version 0.4`
  )
}
