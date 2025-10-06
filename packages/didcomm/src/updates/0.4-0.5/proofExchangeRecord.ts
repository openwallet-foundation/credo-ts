import type { BaseAgent } from '@credo-ts/core'

import { CredoError } from '@credo-ts/core'

import {
  type DidCommProofExchangeRecord,
  DidCommProofExchangeRepository,
  DidCommProofRole,
  DidCommProofState,
  DidCommProposePresentationV2Message,
  DidCommRequestPresentationV2Message,
} from '../../modules/proofs'
import { DidCommMessageRepository, DidCommMessageRole } from '../../repository'
import { parseMessageType } from '../../util/messageType'

/**
 * Migrates the {@link ProofExchangeExchangeRecord} to 0.5 compatible format. It fetches all proof exchange records from
 *  storage and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link migrateRole}
 */
export async function migrateProofExchangeRecordToV0_5<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating proof exchange records to storage version 0.5')
  const proofRepository = agent.dependencyManager.resolve(DidCommProofExchangeRepository)

  agent.config.logger.debug('Fetching all proof records from storage')
  const proofRecords = await proofRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${proofRecords.length} proof exchange records to update.`)
  for (const proofRecord of proofRecords) {
    agent.config.logger.debug(`Migrating proof exchange record with id ${proofRecord.id} to storage version 0.5`)

    await migrateRole(agent, proofRecord)

    // Save updated record
    await proofRepository.update(agent.context, proofRecord)

    agent.config.logger.debug(
      `Successfully migrated proof exchange record with id ${proofRecord.id} to storage version 0.5`
    )
  }
}

const proverProofStates = [
  DidCommProofState.RequestReceived,
  DidCommProofState.ProposalSent,
  DidCommProofState.PresentationSent,
  DidCommProofState.Declined,
]
const verifierProofStates = [
  DidCommProofState.RequestSent,
  DidCommProofState.ProposalReceived,
  DidCommProofState.PresentationReceived,
]

export async function getProofRole(agent: BaseAgent, proofRecord: DidCommProofExchangeRecord) {
  // For these states we know for certain that we're the prover
  if (proverProofStates.includes(proofRecord.state)) {
    return DidCommProofRole.Prover
  }
  // For these states we know for certain that we're the verifier
  if (verifierProofStates.includes(proofRecord.state)) {
    return DidCommProofRole.Verifier
  }

  // We now need to determine the role based on the didcomm message. Only the Done and Abandoned states
  // remain and we can't be certain of the role based on the state alone.

  // Fetch any of the associated proof messages that we can use to determine the role
  // Either one of these MUST be present or we can't determine the role.
  const didCommMessageRepository = agent.dependencyManager.resolve(DidCommMessageRepository)
  const [didCommMessageRecord] = await didCommMessageRepository.findByQuery(agent.context, {
    associatedRecordId: proofRecord.id,
    $or: [
      // We can't be certain which messages will be present.
      { messageName: DidCommProposePresentationV2Message.type.messageName },
      { messageName: DidCommRequestPresentationV2Message.type.messageName },
    ],
  })

  if (!didCommMessageRecord) {
    throw new CredoError(
      `Unable to determine the role of the proof exchange record with id ${proofRecord.id} without any didcomm messages and state abandoned/done`
    )
  }

  // Maps the message name and the didcomm message role to the respective proof role
  const roleStateMapping = {
    [DidCommProposePresentationV2Message.type.messageName]: {
      [DidCommMessageRole.Sender]: DidCommProofRole.Prover,
      [DidCommMessageRole.Receiver]: DidCommProofRole.Verifier,
    },
    [DidCommRequestPresentationV2Message.type.messageName]: {
      [DidCommMessageRole.Sender]: DidCommProofRole.Verifier,
      [DidCommMessageRole.Receiver]: DidCommProofRole.Prover,
    },
  }

  const messageName = parseMessageType(didCommMessageRecord.message['@type']).messageName
  const proofRole = roleStateMapping[messageName][didCommMessageRecord.role]

  return proofRole
}

/**
 * Add a role to the proof record.
 */
export async function migrateRole<Agent extends BaseAgent>(agent: Agent, proofRecord: DidCommProofExchangeRecord) {
  agent.config.logger.debug(`Adding role to record with id ${proofRecord.id} to for version 0.5`)

  proofRecord.role = await getProofRole(agent, proofRecord)

  agent.config.logger.debug(
    `Successfully updated role to '${proofRecord.role}' on proof record with id ${proofRecord.id} to for version 0.5`
  )
}
