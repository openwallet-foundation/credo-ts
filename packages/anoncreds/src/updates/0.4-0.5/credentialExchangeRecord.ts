import type { BaseAgent, CredentialExchangeRecord } from '@credo-ts/core'

import { CredentialState, CredentialRole, CredentialRepository } from '@credo-ts/core'

/**
 * Migrates the {@link CredentialExchangeRecord} to 0.5 compatible format. It fetches all credential exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateRole}
 */
export async function migrateCredentialExchangeRecordToV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating credential exchange records to storage version 0.5')
  const credentialRepository = agent.dependencyManager.resolve(CredentialRepository)

  agent.config.logger.debug(`Fetching all credential records from storage`)
  const credentialRecords = await credentialRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${credentialRecords.length} credential exchange records to update.`)
  for (const credentialRecord of credentialRecords) {
    agent.config.logger.debug(
      `Migrating credential exchange record with id ${credentialRecord.id} to storage version 0.5`
    )

    await migrateRole(agent, credentialRecord)

    // Save updated record
    await credentialRepository.update(agent.context, credentialRecord)

    agent.config.logger.debug(
      `Successfully migrated credential exchange record with id ${credentialRecord.id} to storage version 0.5`
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

  // For all other states we can be certain we're the issuer
  return CredentialRole.Issuer
}

/**
 * Add a role to the credential record.
 */
export async function migrateRole<Agent extends BaseAgent>(agent: Agent, credentialRecord: CredentialExchangeRecord) {
  agent.config.logger.debug(`Adding role to record with id ${credentialRecord.id} to for version 0.5`)

  credentialRecord.role = await getCredentialRole(agent, credentialRecord)

  agent.config.logger.debug(
    `Successfully updated role to '${credentialRecord.role}' on credential record with id ${credentialRecord.id} to for version 0.5`
  )
}
