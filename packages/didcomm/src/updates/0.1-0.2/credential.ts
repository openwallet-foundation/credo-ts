import type { BaseAgent, JsonObject } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../../modules/credentials'
import type { PlaintextDidCommMessage } from '../../types'

import { Metadata } from '@credo-ts/core'

import { DidCommCredentialState } from '../../modules/credentials/models/DidCommCredentialState'
import { DidCommCredentialExchangeRepository } from '../../modules/credentials/repository/DidCommCredentialExchangeRepository'
import { DidCommMessageRecord, DidCommMessageRepository, DidCommMessageRole } from '../../repository'

/**
 * Migrates the {@link CredentialRecord} to 0.2 compatible format. It fetches all records from storage
 * and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link updateIndyMetadata}
 */
export async function migrateCredentialRecordToV0_2<Agent extends BaseAgent>(agent: Agent) {
  agent.config.logger.info('Migrating credential records to storage version 0.2')
  const credentialRepository = agent.dependencyManager.resolve(DidCommCredentialExchangeRepository)

  agent.config.logger.debug('Fetching all credential records from storage')
  const allCredentials = await credentialRepository.getAll(agent.context)

  agent.config.logger.debug(`Found a total of ${allCredentials.length} credential records to update.`)
  for (const credentialRecord of allCredentials) {
    agent.config.logger.debug(`Migrating credential record with id ${credentialRecord.id} to storage version 0.2`)

    await updateIndyMetadata(agent, credentialRecord)
    await migrateInternalCredentialRecordProperties(agent, credentialRecord)
    await moveDidCommMessages(agent, credentialRecord)

    await credentialRepository.update(agent.context, credentialRecord)

    agent.config.logger.debug(
      `Successfully migrated credential record with id ${credentialRecord.id} to storage version 0.2`
    )
  }
}

export enum V01_02MigrationCredentialRole {
  Issuer = 0,
  Holder = 1,
}

const holderCredentialStates = [
  DidCommCredentialState.Declined,
  DidCommCredentialState.ProposalSent,
  DidCommCredentialState.OfferReceived,
  DidCommCredentialState.RequestSent,
  DidCommCredentialState.CredentialReceived,
]

const didCommMessageRoleMapping = {
  [V01_02MigrationCredentialRole.Issuer]: {
    proposalMessage: DidCommMessageRole.Receiver,
    offerMessage: DidCommMessageRole.Sender,
    requestMessage: DidCommMessageRole.Receiver,
    credentialMessage: DidCommMessageRole.Sender,
  },
  [V01_02MigrationCredentialRole.Holder]: {
    proposalMessage: DidCommMessageRole.Sender,
    offerMessage: DidCommMessageRole.Receiver,
    requestMessage: DidCommMessageRole.Sender,
    credentialMessage: DidCommMessageRole.Receiver,
  },
}

const credentialRecordMessageKeys = ['proposalMessage', 'offerMessage', 'requestMessage', 'credentialMessage'] as const

export function getCredentialRole(credentialRecord: DidCommCredentialExchangeRecord) {
  // Credentials will only have a value when a credential is received, meaning we're the holder
  if (credentialRecord.credentials.length > 0) {
    return V01_02MigrationCredentialRole.Holder
  }
  // If credentialRecord.credentials doesn't have any values, and we're also not in state done it means we're the issuer.
  if (credentialRecord.state === DidCommCredentialState.Done) {
    return V01_02MigrationCredentialRole.Issuer
  }
  // For these states we know for certain that we're the holder
  if (holderCredentialStates.includes(credentialRecord.state)) {
    return V01_02MigrationCredentialRole.Holder
  }

  // For all other states we can be certain we're the issuer
  return V01_02MigrationCredentialRole.Issuer
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
export async function updateIndyMetadata<Agent extends BaseAgent>(
  agent: Agent,
  credentialRecord: DidCommCredentialExchangeRecord
) {
  agent.config.logger.debug('Updating indy metadata to use the generic metadata api available to records.')

  const { requestMetadata, schemaId, credentialDefinitionId, ...rest } = credentialRecord.metadata.data
  const metadata = new Metadata<Record<string, unknown>>(rest)

  const indyRequestMetadataKey = '_internal/indyRequest'
  const indyCredentialMetadataKey = '_internal/indyCredential'
  if (requestMetadata) {
    agent.config.logger.trace(`Found top-level 'requestMetadata' key, moving to '${indyRequestMetadataKey}'`)
    metadata.add(indyRequestMetadataKey, { ...requestMetadata })
  }

  if (schemaId && typeof schemaId === 'string') {
    agent.config.logger.trace(`Found top-level 'schemaId' key, moving to '${indyCredentialMetadataKey}.schemaId'`)
    metadata.add(indyCredentialMetadataKey, { schemaId })
  }

  if (credentialDefinitionId && typeof credentialDefinitionId === 'string') {
    agent.config.logger.trace(
      `Found top-level 'credentialDefinitionId' key, moving to '${indyCredentialMetadataKey}.credentialDefinitionId'`
    )
    metadata.add(indyCredentialMetadataKey, { credentialDefinitionId })
  }

  credentialRecord.metadata = metadata
}

/**
 * With the addition of support for different protocol versions the credential record now stores the protocol version.
 * With the addition of issue credential v2 support, other credential formats than indy can be used, and multiple credentials can be issued at once. To
 * account for this the `credentialId` has been replaced by the `credentials` array. This is an array of objects containing the `credentialRecordId` and
 * the `credentialRecordType`. For all current credentials the `credentialRecordType` will always be `indy`.
 *
 * The following 0.1.0 credential record structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "credentialId": "09e46da9-a575-4909-b016-040e96c3c539"
 * }
 * ```
 *
 * Will be transformed into the following 0.2.0 structure (unrelated keys omitted):
 *
 * ```json
 * {
 *  "protocolVersion: "v1",
 *  "credentials": [
 *    {
 *      "credentialRecordId": "09e46da9-a575-4909-b016-040e96c3c539",
 *      "credentialRecordType": "anoncreds"
 *    }
 *  ]
 * }
 * ```
 */
export async function migrateInternalCredentialRecordProperties<Agent extends BaseAgent>(
  agent: Agent,
  credentialRecord: DidCommCredentialExchangeRecord
) {
  agent.config.logger.debug(
    `Migrating internal credential record ${credentialRecord.id} properties to storage version 0.2`
  )

  if (!credentialRecord.protocolVersion) {
    agent.config.logger.debug('Setting protocolVersion to v1')
    credentialRecord.protocolVersion = 'v1'
  }

  const untypedCredentialRecord = credentialRecord as unknown as JsonObject

  if (untypedCredentialRecord.credentialId) {
    agent.config.logger.debug(`Migrating indy credentialId ${untypedCredentialRecord.id} to credentials array`)
    credentialRecord.credentials = [
      {
        credentialRecordId: untypedCredentialRecord.credentialId as string,
        credentialRecordType: 'indy',
      },
    ]

    // biome-ignore lint/performance/noDelete: <explanation>
    delete untypedCredentialRecord.credentialId
  }

  agent.config.logger.debug(
    `Successfully migrated internal credential record ${credentialRecord.id} properties to storage version 0.2`
  )
}

/**
 * In 0.2.0 the v1 didcomm messages have been moved out of the credential record into separate record using the DidCommMessageRepository.
 * This migration scripts extracts all message (proposalMessage, offerMessage, requestMessage, credentialMessage) and moves
 * them into the DidCommMessageRepository.
 */
export async function moveDidCommMessages<Agent extends BaseAgent>(
  agent: Agent,
  credentialRecord: DidCommCredentialExchangeRecord
) {
  agent.config.logger.debug(
    `Moving didcomm messages from credential record with id ${credentialRecord.id} to DidCommMessageRecord`
  )
  const didCommMessageRepository = agent.dependencyManager.resolve(DidCommMessageRepository)

  for (const messageKey of credentialRecordMessageKeys) {
    agent.config.logger.debug(
      `Starting move of ${messageKey} from credential record with id ${credentialRecord.id} to DIDCommMessageRecord`
    )
    const credentialRecordJson = credentialRecord as unknown as JsonObject
    const message = credentialRecordJson[messageKey] as PlaintextDidCommMessage | undefined

    if (message) {
      const credentialRole = getCredentialRole(credentialRecord)
      const didCommMessageRole = didCommMessageRoleMapping[credentialRole][messageKey]

      const didCommMessageRecord = new DidCommMessageRecord({
        role: didCommMessageRole,
        associatedRecordId: credentialRecord.id,
        message,
      })
      await didCommMessageRepository.save(agent.context, didCommMessageRecord)

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
