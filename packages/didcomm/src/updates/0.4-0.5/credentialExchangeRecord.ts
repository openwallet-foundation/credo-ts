import type { BaseAgent } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../../modules/credentials'

import { CredoError } from '@credo-ts/core'

import {
  DidCommCredentialExchangeRepository,
  DidCommCredentialRole,
  DidCommCredentialState,
  V2OfferCredentialMessage,
  V2ProposeCredentialMessage,
  V2RequestCredentialMessage,
} from '../../modules/credentials'
import { DidCommMessageRepository, DidCommMessageRole } from '../../repository'
import { parseMessageType } from '../../util/messageType'

/**
 * Migrates the {@link DidCommCredentialExchangeRecord} to 0.5 compatible format. It fetches all credential exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateRole}
 */
export async function migrateCredentialExchangeRecordToV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating credential exchange records to storage version 0.5')
  const credentialRepository = agent.dependencyManager.resolve(DidCommCredentialExchangeRepository)

  agent.config.logger.debug('Fetching all credential records from storage')
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
  DidCommCredentialState.Declined,
  DidCommCredentialState.ProposalSent,
  DidCommCredentialState.OfferReceived,
  DidCommCredentialState.RequestSent,
  DidCommCredentialState.CredentialReceived,
]

const issuerCredentialStates = [
  DidCommCredentialState.ProposalReceived,
  DidCommCredentialState.OfferSent,
  DidCommCredentialState.RequestReceived,
  DidCommCredentialState.CredentialIssued,
]

export async function getCredentialRole(agent: BaseAgent, credentialRecord: DidCommCredentialExchangeRecord) {
  // Credentials will only have a value when a credential is received, meaning we're the holder
  if (credentialRecord.credentials.length > 0) {
    return DidCommCredentialRole.Holder
  }
  // If credentialRecord.credentials doesn't have any values, and we're also not in state done it means we're the issuer.
  if (credentialRecord.state === DidCommCredentialState.Done) {
    return DidCommCredentialRole.Issuer
  }
  // For these states we know for certain that we're the holder
  if (holderCredentialStates.includes(credentialRecord.state)) {
    return DidCommCredentialRole.Holder
  }
  // For these states we know for certain that we're the issuer
  if (issuerCredentialStates.includes(credentialRecord.state)) {
    return DidCommCredentialRole.Issuer
  }

  // We now need to determine the role based on the didcomm message. Only the Abandoned state remains
  // and we can't be certain of the role based on the state alone.

  // Fetch any of the associated credential messages that we can use to determine the role
  // Either one of these MUST be present or we can't determine the role.
  const didCommMessageRepository = agent.dependencyManager.resolve(DidCommMessageRepository)
  const [didCommMessageRecord] = await didCommMessageRepository.findByQuery(agent.context, {
    associatedRecordId: credentialRecord.id,
    $or: [
      // We can't be certain which messages will be present.
      { messageName: V2OfferCredentialMessage.type.messageName },
      { messageName: V2ProposeCredentialMessage.type.messageName },
      { messageName: V2RequestCredentialMessage.type.messageName },
    ],
  })

  if (!didCommMessageRecord) {
    throw new CredoError(
      `Unable to determine the role of the credential exchange record with id ${credentialRecord.id} without any didcomm messages and state abandoned`
    )
  }

  // Maps the message name and the didcomm message role to the respective credential role
  const roleStateMapping = {
    [V2OfferCredentialMessage.type.messageName]: {
      [DidCommMessageRole.Sender]: DidCommCredentialRole.Issuer,
      [DidCommMessageRole.Receiver]: DidCommCredentialRole.Holder,
    },
    [V2ProposeCredentialMessage.type.messageName]: {
      [DidCommMessageRole.Sender]: DidCommCredentialRole.Holder,
      [DidCommMessageRole.Receiver]: DidCommCredentialRole.Issuer,
    },
    [V2RequestCredentialMessage.type.messageName]: {
      [DidCommMessageRole.Sender]: DidCommCredentialRole.Holder,
      [DidCommMessageRole.Receiver]: DidCommCredentialRole.Issuer,
    },
  }

  const messageName = parseMessageType(didCommMessageRecord.message['@type']).messageName
  const credentialRole = roleStateMapping[messageName][didCommMessageRecord.role]

  return credentialRole
}

/**
 * Add a role to the credential record.
 */
export async function migrateRole<Agent extends BaseAgent>(agent: Agent, credentialRecord: DidCommCredentialExchangeRecord) {
  agent.config.logger.debug(`Adding role to record with id ${credentialRecord.id} to for version 0.4`)

  credentialRecord.role = await getCredentialRole(agent, credentialRecord)

  agent.config.logger.debug(
    `Successfully updated role to '${credentialRecord.role}' on credential record with id ${credentialRecord.id} to for version 0.4`
  )
}
