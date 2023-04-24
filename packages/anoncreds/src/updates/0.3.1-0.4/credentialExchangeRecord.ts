import type { BaseAgent, CredentialExchangeRecord } from '@aries-framework/core'

import { CredentialRole, CredentialState, CredentialRepository } from '@aries-framework/core'

/**
 * Migrates the {@link CredentialExchangeRecord} to 0.4 compatible format. It fetches all credential exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateIndyCredentialMetadataToAnonCredsMetadata}
 *  - {@link migrateIndyCredentialTypeToAnonCredsCredential}
 *  - {@link migrateRole}
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
    await migrateRole(agent, credentialRecord)

    // Save updated did record
    await credentialRepository.update(agent.context, credentialRecord)

    agent.config.logger.debug(
      `Successfully migrated credential exchange record with id ${credentialRecord.id} to storage version 0.4`
    )
  }
}

const holderCredentialStates = [
  CredentialState.Declined,
  CredentialState.ProposalSent,
  CredentialState.OfferReceived,
  CredentialState.RequestSent,
  CredentialState.CredentialReceived,
]

export async function getCredentialRole(agent: BaseAgent, credentialRecord: CredentialExchangeRecord) {
  // Credentials will only have a value when a credential is received, meaning we're the holder
  if (credentialRecord.credentials.length > 0) {
    return CredentialRole.Holder
  }
  // If credentialRecord.credentials doesn't have any values, and we're also not in state done it means we're the issuer.
  else if (credentialRecord.state === CredentialState.Done) {
    return CredentialRole.Issuer
  }
  // For these states we know for certain that we're the holder
  else if (holderCredentialStates.includes(credentialRecord.state)) {
    return CredentialRole.Holder
  }

  // FIXME: we need to determine the role based on the didcomm messages
  // If we have role Sender on e.g. offer we are the issuer

  // For all other states we can be certain we're the issuer
  return CredentialRole.Issuer
}

/**
 * Add a role to the credential record.
 */
export async function migrateRole<Agent extends BaseAgent>(agent: Agent, credentialRecord: CredentialExchangeRecord) {
  agent.config.logger.debug(`Adding role to record with id ${credentialRecord.id} to for version 0.4`)

  credentialRecord.role = await getCredentialRole(agent, credentialRecord)

  agent.config.logger.debug(
    `Successfully updated role to '${credentialRecord.role}' on credential record with id ${credentialRecord.id} to for version 0.4`
  )
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
    credentialRecord.metadata.set(ANONCREDS_CREDENTIAL_REQUEST_METADATA, {
      link_secret_blinding_data: indyCredentialRequestMetadata.master_secret_blinding_data,
      link_secret_name: indyCredentialRequestMetadata.master_secret_name,
      nonce: indyCredentialRequestMetadata.nonce,
    })
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
