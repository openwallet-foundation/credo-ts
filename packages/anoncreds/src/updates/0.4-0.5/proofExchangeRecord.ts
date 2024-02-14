import type { BaseAgent, ProofExchangeRecord } from '@credo-ts/core'

import {
  V2ProposePresentationMessage,
  V2RequestPresentationMessage,
  ProofRole,
  ProofState,
  ProofRepository,
  DidCommMessageRepository,
  DidCommMessageRole,
} from '@credo-ts/core'

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
  const proofRepository = agent.dependencyManager.resolve(ProofRepository)

  agent.config.logger.debug(`Fetching all proof records from storage`)
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

const proverProofStates = [ProofState.RequestReceived, ProofState.ProposalSent, ProofState.PresentationSent]
export async function getProofRole(agent: BaseAgent, proofRecord: ProofExchangeRecord) {
  // For these states we know for certain that we're the prover
  if (proverProofStates.includes(proofRecord.state)) {
    return ProofRole.Prover
  } else if (proofRecord.state === ProofState.Done) {
    // Fetch the associated didcomm message record
    const didCommMessageRepository = agent.dependencyManager.resolve(DidCommMessageRepository)

    // `getSingleByQuery` is used here instead of `getAgentMessage` as `getAgentMessage`
    // converts it into the message which loses the `role` property.
    const didCommMessageRecord = await didCommMessageRepository.getSingleByQuery(agent.context, {
      associatedRecordId: proofRecord.id,
      messageName: V2RequestPresentationMessage.type.messageName,
      protocolName: V2RequestPresentationMessage.type.protocolName,
      protocolMajorVersion: String(V2RequestPresentationMessage.type.protocolMajorVersion),
    })

    // Sender of the request message is always a verifier
    if (didCommMessageRecord.role === DidCommMessageRole.Sender) {
      return ProofRole.Verifier
    }

    // Recipient of the request message is always a prover
    if (didCommMessageRecord.role === DidCommMessageRole.Receiver) {
      return ProofRole.Prover
    }
  } else if (proofRecord.state === ProofState.Abandoned) {
    // Fetch the associated didcomm message record
    const didCommMessageRepository = agent.dependencyManager.resolve(DidCommMessageRepository)

    // `findSingleByQuery` is used here instead of `getAgentMessage` as `getAgentMessage`
    // converts it into the message which loses the `role` property.
    const didCommMessageRecordForRequest = await didCommMessageRepository.findSingleByQuery(agent.context, {
      associatedRecordId: proofRecord.id,
      messageName: V2RequestPresentationMessage.type.messageName,
      protocolName: V2RequestPresentationMessage.type.protocolName,
      protocolMajorVersion: String(V2RequestPresentationMessage.type.protocolMajorVersion),
    })

    if (didCommMessageRecordForRequest) {
      if (didCommMessageRecordForRequest.role === DidCommMessageRole.Sender) {
        return ProofRole.Verifier
      }
      if (didCommMessageRecordForRequest.role === DidCommMessageRole.Receiver) {
        return ProofRole.Prover
      }
    }

    // `findSingleByQuery` is used here instead of `getAgentMessage` as `getAgentMessage`
    // converts it into the message which loses the `role` property.
    const didCommMessageRecordForProposal = await didCommMessageRepository.findSingleByQuery(agent.context, {
      associatedRecordId: proofRecord.id,
      messageName: V2ProposePresentationMessage.type.messageName,
      protocolName: V2ProposePresentationMessage.type.protocolName,
      protocolMajorVersion: String(V2ProposePresentationMessage.type.protocolMajorVersion),
    })

    if (didCommMessageRecordForProposal) {
      if (didCommMessageRecordForProposal.role === DidCommMessageRole.Sender) {
        return ProofRole.Prover
      }
      if (didCommMessageRecordForProposal.role === DidCommMessageRole.Receiver) {
        return ProofRole.Verifier
      }
    }
  }

  // For all other states we can be certain we're the issuer
  return ProofRole.Verifier
}

/**
 * Add a role to the proof record.
 */
export async function migrateRole<Agent extends BaseAgent>(agent: Agent, proofRecord: ProofExchangeRecord) {
  agent.config.logger.debug(`Adding role to record with id ${proofRecord.id} to for version 0.5`)

  proofRecord.role = await getProofRole(agent, proofRecord)

  agent.config.logger.debug(
    `Successfully updated role to '${proofRecord.role}' on proof record with id ${proofRecord.id} to for version 0.5`
  )
}
