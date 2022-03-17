import type { Agent } from '../../../../agent/Agent'
import type { CredentialRecord } from '../../../../modules/credentials'
import type { JsonObject } from '../../../../types'

import { CredentialState } from '../../../../modules/credentials/CredentialState'
import { CredentialRepository } from '../../../../modules/credentials/repository/CredentialRepository'
import { DidCommMessageRecord, DidCommMessageRepository, DidCommMessageRole } from '../../../didcomm'

export async function migrateCredentialRecordToV20(agent: Agent) {
  agent.config.logger.info('Migrating credential records to storage version 0.2')
  const credentialRepository = agent.injectionContainer.resolve(CredentialRepository)

  const allCredentials = await credentialRepository.getAll()

  for (const credentialRecord of allCredentials) {
    agent.config.logger.debug(`Migrating credential record with id ${credentialRecord.id} to storage version 0.2`)
    await moveDidCommMessages(agent, credentialRecord)

    // TODO: other properties that need migration for credential
    // - credential metadata
    // - protocolVersion default value
    // - move credentialId to credentialBinding -> Also update the tags (credentialId)

    await credentialRepository.update(credentialRecord)
  }
}

const enum CredentialRole {
  Issuer,
  Holder,
}

const holderCredentialStates = [
  CredentialState.Declined,
  CredentialState.ProposalSent,
  CredentialState.OfferReceived,
  CredentialState.RequestSent,
  CredentialState.CredentialReceived,
]

export const didCommMessageRoleMapping = {
  [CredentialRole.Issuer]: {
    proposalMessage: DidCommMessageRole.Receiver,
    offerMessage: DidCommMessageRole.Sender,
    requestMessage: DidCommMessageRole.Receiver,
    credentialMessage: DidCommMessageRole.Sender,
  },
  [CredentialRole.Holder]: {
    proposalMessage: DidCommMessageRole.Sender,
    offerMessage: DidCommMessageRole.Receiver,
    requestMessage: DidCommMessageRole.Sender,
    credentialMessage: DidCommMessageRole.Receiver,
  },
}

const credentialRecordMessageKeys = ['proposalMessage', 'offerMessage', 'requestMessage', 'credentialMessage'] as const

function getCredentialRole(credentialRecord: CredentialRecord) {
  // This only works for v1 records created before the switch to didcomm message records
  // But records created after the switch are already using the didcomm message record
  // So that shouldn't be a problem

  // Credential id is only set when a credential is received
  if (credentialRecord.credentialId) {
    return CredentialRole.Holder
  }
  // If credentialRecord.credentialId is not set, and we're also not in state done it means we're the issuer.
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

async function moveDidCommMessages(agent: Agent, credentialRecord: CredentialRecord) {
  agent.config.logger.debug(
    `Moving didcomm messages from credential record with id ${credentialRecord.id} to DIDCommMessageRecord`
  )
  const didCommMessageRepository = agent.injectionContainer.resolve(DidCommMessageRepository)

  for (const messageKey of credentialRecordMessageKeys) {
    agent.config.logger.debug(
      `Starting move of ${messageKey} from credential record with id ${credentialRecord.id} to DIDCommMessageRecord`
    )
    const credentialRecordJson = credentialRecord as unknown as JsonObject
    const message = credentialRecordJson[messageKey] as JsonObject | undefined

    if (message) {
      const credentialRole = getCredentialRole(credentialRecord)
      const didCommMessageRole = didCommMessageRoleMapping[credentialRole][messageKey]

      const didcommMessageRecord = new DidCommMessageRecord({
        role: didCommMessageRole,
        associatedRecordId: credentialRecord.id,
        message,
      })
      await didCommMessageRepository.save(didcommMessageRecord)

      agent.config.logger.debug(
        `Successfully moved ${messageKey} from credential record with id ${credentialRecord.id} to DIDCommMessageRecord`
      )

      delete credentialRecordJson[messageKey]
    } else {
      agent.config.logger.debug(
        `Credential record with id ${credentialRecord.id} does not have a ${messageKey}. Not creating a DIDCommMessageRecord`
      )
    }
  }

  agent.config.logger.debug(
    `Successfully moved didcomm messages from credential record with id ${credentialRecord.id} to DIDCommMessageRecord`
  )
}
