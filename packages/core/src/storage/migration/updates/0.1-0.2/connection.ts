import type { Agent } from '../../../../agent/Agent'
import type { ConnectionRecord } from '../../../../modules/connections'
import type { JsonObject } from '../../../../types'

import {
  DidExchangeState,
  ConnectionState,
  ConnectionInvitationMessage,
  ConnectionRole,
  DidDoc,
  ConnectionRepository,
  DidExchangeRole,
} from '../../../../modules/connections'
import { convertToNewDidDocument } from '../../../../modules/connections/services/helpers'
import { DidDocumentRole } from '../../../../modules/dids/domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../../../modules/dids/repository'
import { DidRecordMetadataKeys } from '../../../../modules/dids/repository/didRecordMetadataTypes'
import { OutOfBandRole } from '../../../../modules/oob/domain/OutOfBandRole'
import { OutOfBandState } from '../../../../modules/oob/domain/OutOfBandState'
import { convertToNewInvitation } from '../../../../modules/oob/helpers'
import { OutOfBandRecord, OutOfBandRepository } from '../../../../modules/oob/repository'
import { JsonEncoder, JsonTransformer } from '../../../../utils'

/**
 * Migrates the {@link ConnectionRecord} to 0.2 compatible format. It fetches all records from storage
 * and applies the needed updates to the records. After a record has been transformed, it is updated
 * in storage and the next record will be transformed.
 *
 * The following transformations are applied:
 *  - {@link updateConnectionRoleAndState}
 *  - {@link extractDidDocument}
 *  - {@link migrateToOobRecord}
 */
export async function migrateConnectionRecordToV0_2(agent: Agent) {
  agent.config.logger.info('Migrating connection records to storage version 0.2')
  const connectionRepository = agent.injectionContainer.resolve(ConnectionRepository)

  agent.config.logger.debug(`Fetching all connection records from storage`)
  const allConnections = await connectionRepository.getAll()

  agent.config.logger.debug(`Found a total of ${allConnections.length} connection records to update.`)
  for (const connectionRecord of allConnections) {
    agent.config.logger.debug(`Migrating connection record with id ${connectionRecord.id} to storage version 0.2`)

    await updateConnectionRoleAndState(agent, connectionRecord)
    await extractDidDocument(agent, connectionRecord)

    // migration of oob record MUST run after extracting the did document as it relies on the updated did
    // it also MUST run after update the connection role and state as it assumes the values are
    // did exchange roles and states
    await migrateToOobRecord(agent, connectionRecord)

    await connectionRepository.update(connectionRecord)

    agent.config.logger.debug(
      `Successfully migrated connection record with id ${connectionRecord.id} to storage version 0.2`
    )
  }
}

/**
 * With the addition of the did exchange protocol there are now two states and roles related to the connection record; for the did exchange protocol and for the connection protocol.
 * To keep it easy to work with the connection record, all state and role values are updated to those of the {@link DidExchangeRole} and {@link DidExchangeState}.
 *
 * This migration method transforms all connection record state and role values to their respective values of the {@link DidExchangeRole} and {@link DidExchangeState}. For convenience a getter
 * property `rfc0160ConnectionState` is added to the connection record which returns the {@link ConnectionState} value.
 *
 * The following 0.1.0 connection record structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "state": "invited",
 *   "role": "inviter"
 * }
 * ```
 *
 * Will be transformed into the following 0.2.0 structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "state": "invitation-sent",
 *   "role": "responder",
 * }
 * ```
 */
export async function updateConnectionRoleAndState(agent: Agent, connectionRecord: ConnectionRecord) {
  agent.config.logger.debug(
    `Extracting 'didDoc' and 'theirDidDoc' from connection record into separate DidRecord and updating unqualified dids to did:peer dids`
  )

  const oldState = connectionRecord.state
  connectionRecord.state = didExchangeStateFromConnectionRoleAndState(
    connectionRecord.role as ConnectionRole,
    connectionRecord.state as ConnectionState
  )

  agent.config.logger.debug(`Updated connection record state from ${oldState} to ${connectionRecord.state}`)

  if (connectionRecord.role === ConnectionRole.Inviter) {
    connectionRecord.role = DidExchangeRole.Responder
    agent.config.logger.debug(
      `Updated connection record role from ${ConnectionRole.Inviter} to ${DidExchangeRole.Responder}`
    )
  } else if (connectionRecord.role === ConnectionRole.Invitee) {
    connectionRecord.role = DidExchangeRole.Requester
    agent.config.logger.debug(
      `Updated connection record role from ${ConnectionRole.Invitee} to ${DidExchangeRole.Requester}`
    )
  } else {
    agent.config.logger.debug(
      `Connection record role is not ${ConnectionRole.Invitee} or ${ConnectionRole.Inviter}, not updating role.`
    )
  }
}

/**
 * The connection record previously stored both did documents from a connection in the connection record itself. Version 0.2.0 added a generic did storage that can be used for numerous usages, one of which
 * is the storage of did documents for connection records.
 *
 * This migration method extracts the did documents from the `didDoc` and `theirDidDoc` properties from the connection record, updates them to did documents compliant with the DID Core spec, and stores them
 * in the did repository. By doing so it also updates the unqualified dids in the `did` and `theirDid` fields generated by the indy-sdk to fully qualified `did:peer` dids compliant with
 * the [Peer DID Method Specification](https://identity.foundation/peer-did-method-spec/).
 *
 * To account for the fact that the mechanism to migrate legacy did document to peer did documents is not defined yet, the legacy did and did document are stored in the did record metadata.
 * This will be deleted later if we can be certain the did doc conversion to a did:peer did document is correct.
 *
 * The following 0.1.0 connection record structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "did": "BBPoJqRKatdcfLEAFL7exC",
 *   "theirDid": "N8NQHLtCKfPmWMgCSdfa7h",
 *   "didDoc": <legacyDidDoc>,
 *   "theirDidDoc": <legacyTheirDidDoc>,
 * }
 * ```
 *
 * Will be transformed into the following 0.2.0 structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "did": "did:peer:1zQmXUaPPhPCbUVZ3hGYmQmGxWTwyDfhqESXCpMFhKaF9Y2A",
 *   "theirDid": "did:peer:1zQmZMygzYqNwU6Uhmewx5Xepf2VLp5S4HLSwwgf2aiKZuwa"
 * }
 * ```
 */
export async function extractDidDocument(agent: Agent, connectionRecord: ConnectionRecord) {
  agent.config.logger.debug(
    `Extracting 'didDoc' and 'theirDidDoc' from connection record into separate DidRecord and updating unqualified dids to did:peer dids`
  )

  const didRepository = agent.injectionContainer.resolve(DidRepository)

  const untypedConnectionRecord = connectionRecord as unknown as JsonObject
  const oldDidDocJson = untypedConnectionRecord.didDoc as JsonObject | undefined
  const oldTheirDidDocJson = untypedConnectionRecord.theirDidDoc as JsonObject | undefined

  if (oldDidDocJson) {
    const oldDidDoc = JsonTransformer.fromJSON(oldDidDocJson, DidDoc)

    agent.config.logger.debug(
      `Found a legacy did document for did ${oldDidDoc.id} in connection record didDoc. Converting it to a peer did document.`
    )

    const newDidDocument = convertToNewDidDocument(oldDidDoc)

    // Maybe we already have a record for this did because the migration failed previously
    let didRecord = await didRepository.findById(newDidDocument.id)

    if (!didRecord) {
      agent.config.logger.debug(`Creating did record for did ${newDidDocument.id}`)
      didRecord = new DidRecord({
        id: newDidDocument.id,
        role: DidDocumentRole.Created,
        didDocument: newDidDocument,
        createdAt: connectionRecord.createdAt,
        tags: {
          recipientKeys: newDidDocument.recipientKeys,
        },
      })

      didRecord.metadata.set(DidRecordMetadataKeys.LegacyDid, {
        unqualifiedDid: oldDidDoc.id,
        didDocumentString: JsonEncoder.toString(oldDidDocJson),
      })

      await didRepository.save(didRecord)

      agent.config.logger.debug(`Successfully saved did record for did ${newDidDocument.id}`)
    } else {
      agent.config.logger.debug(`Found existing did record for did ${newDidDocument.id}, not creating did record.`)
    }

    agent.config.logger.debug(`Deleting old did document from connection record and storing new did:peer did`)
    // Remove didDoc and assign the new did:peer did to did
    delete untypedConnectionRecord.didDoc
    connectionRecord.did = newDidDocument.id
  } else {
    agent.config.logger.debug(
      `Did not find a did document in connection record didDoc. Not converting it to a peer did document.`
    )
  }

  if (oldTheirDidDocJson) {
    const oldTheirDidDoc = JsonTransformer.fromJSON(oldTheirDidDocJson, DidDoc)

    agent.config.logger.debug(
      `Found a legacy did document for theirDid ${oldTheirDidDoc.id} in connection record theirDidDoc. Converting it to a peer did document.`
    )

    const newTheirDidDocument = convertToNewDidDocument(oldTheirDidDoc)

    // Maybe we already have a record for this did because the migration failed previously
    let didRecord = await didRepository.findById(newTheirDidDocument.id)

    if (!didRecord) {
      agent.config.logger.debug(`Creating did record for theirDid ${newTheirDidDocument.id}`)

      didRecord = new DidRecord({
        id: newTheirDidDocument.id,
        role: DidDocumentRole.Received,
        didDocument: newTheirDidDocument,
        createdAt: connectionRecord.createdAt,
        tags: {
          recipientKeys: newTheirDidDocument.recipientKeys,
        },
      })

      didRecord.metadata.set(DidRecordMetadataKeys.LegacyDid, {
        unqualifiedDid: oldTheirDidDoc.id,
        didDocumentString: JsonEncoder.toString(oldTheirDidDocJson),
      })

      await didRepository.save(didRecord)

      agent.config.logger.debug(`Successfully saved did record for theirDid ${newTheirDidDocument.id}`)
    } else {
      agent.config.logger.debug(
        `Found existing did record for theirDid ${newTheirDidDocument.id}, not creating did record.`
      )
    }

    agent.config.logger.debug(`Deleting old theirDidDoc from connection record and storing new did:peer theirDid`)
    // Remove theirDidDoc and assign the new did:peer did to theirDid
    delete untypedConnectionRecord.theirDidDoc
    connectionRecord.theirDid = newTheirDidDocument.id
  } else {
    agent.config.logger.debug(
      `Did not find a did document in connection record theirDidDoc. Not converting it to a peer did document.`
    )
  }
}

/**
 * With the addition of the out of band protocol, invitations are now stored in the {@link OutOfBandRecord}. In addition a new field `invitationDid` is added to the connection record that
 * is generated based on the invitation service or did. This allows to reuse existing connections.
 *
 * This migration method extracts the invitation and other relevant data into a separate {@link OutOfBandRecord}. By doing so it converts the old connection protocol invitation into the new
 * Out of band invitation message. Based on the service or did of the invitation, the `invitationDid` is populated.
 *
 * The following 0.1.0 connection record structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "invitation": {
 *     "@type": "https://didcomm.org/connections/1.0/invitation",
 *     "@id": "04a2c382-999e-4de9-a1d2-9dec0b2fa5e4",
 *     "recipientKeys": ["E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu"],
 *     "serviceEndpoint": "https://example.com",
 *     "label": "test",
 *   }
 * }
 * ```
 *
 * Will be transformed into the following 0.2.0 structure (unrelated keys omitted):
 *
 * ```json
 * {
 *   "invitationDid": "did:peer:2.Ez6MksYU4MHtfmNhNm1uGMvANr9j4CBv2FymjiJtRgA36bSVH.SeyJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9",
 *   "outOfBandId": "04a2c382-999e-4de9-a1d2-9dec0b2fa5e4"
 * }
 * ```
 */
export async function migrateToOobRecord(agent: Agent, connectionRecord: ConnectionRecord) {
  agent.config.logger.debug(
    `Migrating properties from connection record with id ${connectionRecord.id} to out of band record`
  )

  const oobRepository = agent.injectionContainer.resolve(OutOfBandRepository)

  const untypedConnectionRecord = connectionRecord as unknown as JsonObject
  const oldInvitationJson = untypedConnectionRecord.invitation as JsonObject | undefined

  // Only migrate if there is an invitation stored
  if (oldInvitationJson) {
    const oldInvitation = JsonTransformer.fromJSON(oldInvitationJson, ConnectionInvitationMessage)

    agent.config.logger.debug(`Found a legacy invitation in connection record. Migrating it to an out of band record.`)

    const oobRecords = await oobRepository.findByQuery({ messageId: oldInvitation.id })
    let oobRecord: OutOfBandRecord | undefined = oobRecords[0]

    // If there already exists an oob record with the same invitation @id, we check whether the did
    // is the same. As the @id is something generated outside of the framework, we can't assume it's globally
    // unique. In addition, with multiUseInvitations all connections will use the same invitation. However,
    // we always create a new did for each connection, so this allows us to determine whether the oob record was
    // already created beforehand.
    // FIXME: As I understand now, with reusable oob records we only create a single oob record for all connections,
    // which means the assumption made above is not correct. We should only reuse the oob record if the invitation
    // 100% matches, but the did can be different
    if (oobRecord && oobRecord.did !== connectionRecord.did) {
      agent.config.logger.debug(
        `Found an out of band record with the same invitation @id but a different did value. Not using the existing out of band record.`
      )

      oobRecord = undefined
    }

    if (!oobRecord) {
      agent.config.logger.debug(`Create out of band record.`)
      const outOfBandInvitation = convertToNewInvitation(oldInvitation)

      const oobRole =
        connectionRecord.role === DidExchangeRole.Responder ? OutOfBandRole.Sender : OutOfBandRole.Receiver

      const connectionRole = connectionRecord.role as DidExchangeRole
      const connectionState = connectionRecord.state as DidExchangeState
      const oobState = oobStateFromDidExchangeRoleAndState(connectionRole, connectionState)

      oobRecord = new OutOfBandRecord({
        role: oobRole,
        state: oobState,
        autoAcceptConnection: connectionRecord.autoAcceptConnection,
        did: connectionRecord.did,
        outOfBandMessage: outOfBandInvitation,
        reusable: connectionRecord.multiUseInvitation,
        mediatorId: connectionRecord.mediatorId,
        createdAt: connectionRecord.createdAt,
      })

      await oobRepository.save(oobRecord)
      agent.config.logger.debug(`Successfully saved out of band record for invitation @id ${oldInvitation.id}`)
    } else {
      agent.config.logger.debug(
        `Found existing out of band record for invitation @id ${oldInvitation.id} and did ${connectionRecord.did}, not creating a new out of band record.`
      )
    }

    agent.config.logger.debug(`Setting invitationDid and outOfBand Id, and removing invitation from connection record`)
    // All connections have been made using the connection protocol, which means we can be certain
    // that there was only one service, thus we can use the first oob message service
    const [invitationDid] = oobRecord.outOfBandMessage.invitationDids
    connectionRecord.invitationDid = invitationDid

    // Remove invitation and assign the oob id to the connection record
    delete untypedConnectionRecord.invitation
    connectionRecord.outOfBandId = oobRecord.id
  }
}

/**
 * Determine the out of band state based on the did exchange role and state.
 */
export function oobStateFromDidExchangeRoleAndState(role: DidExchangeRole, state: DidExchangeState) {
  const stateMapping = {
    [DidExchangeState.InvitationReceived]: OutOfBandState.PrepareResponse,
    [DidExchangeState.InvitationSent]: OutOfBandState.AwaitResponse,

    [DidExchangeState.RequestReceived]: OutOfBandState.Done,
    [DidExchangeState.RequestSent]: OutOfBandState.Done,

    [DidExchangeState.ResponseReceived]: OutOfBandState.Done,
    [DidExchangeState.ResponseSent]: OutOfBandState.Done,

    [DidExchangeState.Completed]: OutOfBandState.Done,
    [DidExchangeState.Abandoned]: OutOfBandState.Done,
  }

  if (state === DidExchangeState.Start) {
    return role === DidExchangeRole.Requester ? OutOfBandState.PrepareResponse : OutOfBandState.AwaitResponse
  }

  return stateMapping[state]
}

/**
 * Determine the did exchange state based on the connection role and state.
 */
export function didExchangeStateFromConnectionRoleAndState(role: ConnectionRole, state: ConnectionState) {
  const roleStateMapping = {
    [ConnectionRole.Invitee]: {
      // DidExchangeRole.Requester
      [ConnectionState.Invited]: DidExchangeState.InvitationReceived,
      [ConnectionState.Requested]: DidExchangeState.RequestSent,
      [ConnectionState.Responded]: DidExchangeState.ResponseReceived,
      [ConnectionState.Complete]: DidExchangeState.Completed,
    },
    [ConnectionRole.Inviter]: {
      // DidExchangeRole.Responder
      [ConnectionState.Invited]: DidExchangeState.InvitationSent,
      [ConnectionState.Requested]: DidExchangeState.RequestReceived,
      [ConnectionState.Responded]: DidExchangeState.ResponseSent,
      [ConnectionState.Complete]: DidExchangeState.Completed,
    },
  }

  // Take into account possibility that the record state was already updated to
  // didExchange state and roles. This makes the script re-runnable and
  // adds some resiliency to the script.
  const stateMapping = roleStateMapping[role]
  if (!stateMapping) return state

  const newState = stateMapping[state]
  if (!newState) return state

  return newState
}
