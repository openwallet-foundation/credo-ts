import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import {
  CredoError,
  DidRepository,
  EventEmitter,
  filterContextCorrelationId,
  InjectionSymbols,
  inject,
  injectable,
  Kms,
  type Logger,
} from '@credo-ts/core'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRole } from '../../oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../oob/domain/DidCommOutOfBandState'
import { DidCommInvitationType } from '../../oob/messages'
import { DidCommOutOfBandRepository } from '../../oob/repository'
import { DidCommOutOfBandRecordMetadataKeys } from '../../oob/repository/outOfBandRecordMetadataTypes'
import type { DidCommConnectionStateChangedEvent } from '../DidCommConnectionEvents'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import { DidCommTrustPingMessage } from '../messages'
import type { DidCommConnectionType } from '../models'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from '../models'
import type { DidCommConnectionRecordProps } from '../repository'
import { DidCommConnectionRecord, DidCommConnectionRepository } from '../repository'

@injectable()
export class DidCommConnectionService {
  private connectionRepository: DidCommConnectionRepository
  private didRepository: DidRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    connectionRepository: DidCommConnectionRepository,
    didRepository: DidRepository,
    eventEmitter: EventEmitter
  ) {
    this.connectionRepository = connectionRepository
    this.didRepository = didRepository
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * By default a trust ping message should elicit a response. If this is not desired the
   * `config.responseRequested` property can be set to `false`.
   *
   * @param connectionRecord the connection for which to create a trust ping message
   * @param config the config for the trust ping message
   * @returns outbound message containing trust ping message
   */
  public async createTrustPing(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    config: { responseRequested?: boolean; comment?: string } = {}
  ): Promise<ConnectionProtocolMsgReturnType<DidCommTrustPingMessage>> {
    connectionRecord.assertState([DidCommDidExchangeState.ResponseReceived, DidCommDidExchangeState.Completed])

    // TODO:
    //  - create ack message
    //  - maybe this shouldn't be in the connection service?
    const trustPing = new DidCommTrustPingMessage(config)

    // Only update connection record and emit an event if the state is not already 'Complete'
    if (connectionRecord.state !== DidCommDidExchangeState.Completed) {
      await this.updateState(agentContext, connectionRecord, DidCommDidExchangeState.Completed)
    }

    return {
      connectionRecord,
      message: trustPing,
    }
  }

  /**
   * Assert that an inbound message either has a connection associated with it,
   * or has everything correctly set up for connection-less exchange (optionally with out of band)
   *
   * @param messageContext - the inbound message context
   */
  public async assertConnectionOrOutOfBandExchange(
    messageContext: DidCommInboundMessageContext,
    {
      lastSentMessage,
      lastReceivedMessage,
      expectedConnectionId,
    }: {
      lastSentMessage?: DidCommMessage | null
      lastReceivedMessage?: DidCommMessage | null
      expectedConnectionId?: string
    } = {}
  ) {
    const { connection, message } = messageContext

    if (expectedConnectionId && !connection) {
      throw new CredoError(
        `Expected incoming message to be from connection ${expectedConnectionId} but no connection found.`
      )
    }
    if (expectedConnectionId && connection?.id !== expectedConnectionId) {
      throw new CredoError(
        `Expected incoming message to be from connection ${expectedConnectionId} but connection is ${connection?.id}.`
      )
    }

    // Check if we have a ready connection. Verification is already done somewhere else. Return
    if (connection) {
      connection.assertReady()
      this.logger.debug(`Processing message with id ${message.id} and connection id ${connection.id}`, {
        type: message.type,
      })
    } else {
      this.logger.debug(`Processing connection-less message with id ${message.id}`, {
        type: message.type,
      })

      const recipientKey = messageContext.recipientKey
      const senderKey = messageContext.senderKey

      // set theirService to the value of lastReceivedMessage.service
      let theirService =
        messageContext.message?.service?.resolvedDidCommService ?? lastReceivedMessage?.service?.resolvedDidCommService
      let ourService = lastSentMessage?.service?.resolvedDidCommService

      // FIXME: we should remove support for the flow where no out of band record is used.
      // Users have had enough time to update to the OOB API which supports legacy connectionsless
      // invitations as well
      // 1. check if there's an oob record associated.
      const outOfBandRepository = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
      const outOfBandService = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandService)
      const outOfBandRecord = await outOfBandRepository.findSingleByQuery(messageContext.agentContext, {
        invitationRequestsThreadIds: [message.threadId],
      })

      // If we have an out of band record, we can extract the service for our/the other party from the oob record
      if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
        ourService = await outOfBandService.getResolvedServiceForOutOfBandServices(
          messageContext.agentContext,
          outOfBandRecord.outOfBandInvitation.getServices(),
          outOfBandRecord.invitationInlineServiceKeys
        )
      } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
        theirService = await outOfBandService.getResolvedServiceForOutOfBandServices(
          messageContext.agentContext,
          outOfBandRecord.outOfBandInvitation.getServices()
        )
      }

      // theirService can be null when we receive an oob invitation and process the message.
      // In this case there MUST be an oob record, otherwise there is no way for us to reply
      // to the message
      if (!theirService && !outOfBandRecord) {
        throw new CredoError(
          'No service for incoming connection-less message and no associated out of band record found.'
        )
      }

      // ourService can be null when we receive an oob invitation or legacy connectionless message and process the message.
      // In this case lastSentMessage and lastReceivedMessage MUST be null, because there shouldn't be any previous exchange
      if (!ourService && (lastReceivedMessage || lastSentMessage)) {
        throw new CredoError(
          'No keys on our side to use for encrypting messages, and previous messages found (in which case our keys MUST also be present).'
        )
      }

      // If the message is unpacked or AuthCrypt, there cannot be any previous exchange (this must be the first message).
      // All exchange after the first unpacked oob exchange MUST be encrypted.
      if ((!senderKey || !recipientKey) && (lastSentMessage || lastReceivedMessage)) {
        throw new CredoError(
          'Incoming message must have recipientKey and senderKey (so cannot be AuthCrypt or unpacked) if there are lastSentMessage or lastReceivedMessage.'
        )
      }

      // Check if recipientKey is in ourService
      if (recipientKey && ourService) {
        const recipientKeyFound = ourService.recipientKeys.some((key) => recipientKey.equals(key))
        if (!recipientKeyFound) {
          throw new CredoError(`Recipient key ${recipientKey.fingerprint} not found in our service`)
        }
      }

      // Check if senderKey is in theirService
      if (senderKey && theirService) {
        const senderKeyFound = theirService.recipientKeys.some((key) => senderKey.equals(key))
        if (!senderKeyFound) {
          throw new CredoError(`Sender key ${senderKey.fingerprint} not found in their service.`)
        }
      }
    }
  }

  /**
   * If knownConnectionId is passed, it will compare the incoming connection id with the knownConnectionId, and skip the other validation.
   *
   * If no known connection id is passed, it asserts that the incoming message is in response to an attached request message to an out of band invitation.
   * If is the case, and the state of the out of band record is still await response, the state will be updated to done
   *
   */
  public async matchIncomingMessageToRequestMessageInOutOfBandExchange(
    messageContext: DidCommInboundMessageContext,
    { expectedConnectionId }: { expectedConnectionId?: string }
  ) {
    if (expectedConnectionId && messageContext.connection?.id !== expectedConnectionId) {
      throw new CredoError(
        `Expecting incoming message to have connection ${expectedConnectionId}, but incoming connection is ${
          messageContext.connection?.id ?? 'undefined'
        }`
      )
    }

    const outOfBandRepository = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
    const outOfBandInvitationId = messageContext.message.thread?.parentThreadId

    // Find the out of band record that is associated with this request
    const outOfBandRecord = await outOfBandRepository.findSingleByQuery(messageContext.agentContext, {
      invitationId: outOfBandInvitationId,
      role: DidCommOutOfBandRole.Sender,
      invitationRequestsThreadIds: [messageContext.message.threadId],
    })

    // There is no out of band record
    if (!outOfBandRecord) {
      throw new CredoError(
        `No out of band record found for credential request message with thread ${messageContext.message.threadId}, out of band invitation id ${outOfBandInvitationId} and role ${DidCommOutOfBandRole.Sender}`
      )
    }

    const legacyInvitationMetadata = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.LegacyInvitation)

    // If the original invitation was a legacy connectionless invitation, it's okay if the message does not have a pthid.
    if (
      legacyInvitationMetadata?.legacyInvitationType !== DidCommInvitationType.Connectionless &&
      outOfBandRecord.outOfBandInvitation.id !== outOfBandInvitationId
    ) {
      throw new CredoError(
        'Response messages to out of band invitation requests MUST have a parent thread id that matches the out of band invitation id.'
      )
    }

    // This should not happen, as it is not allowed to create reusable out of band invitations with attached messages
    // But should that implementation change, we at least cover it here.
    if (outOfBandRecord.reusable) {
      throw new CredoError('Receiving messages in response to reusable out of band invitations is not supported.')
    }

    if (outOfBandRecord.state === DidCommOutOfBandState.Done) {
      if (!messageContext.connection) {
        throw new CredoError(
          "Can't find connection associated with incoming message, while out of band state is done. State must be await response if no connection has been created"
        )
      }
      if (messageContext.connection.outOfBandId !== outOfBandRecord.id) {
        throw new CredoError(
          'Connection associated with incoming message is not associated with the out of band invitation containing the attached message.'
        )
      }

      // We're good to go. Connection was created and points to the correct out of band record. And the message is in response to an attached request message from the oob invitation.
    } else if (outOfBandRecord.state === DidCommOutOfBandState.AwaitResponse) {
      // We're good to go. Waiting for a response. And the message is in response to an attached request message from the oob invitation.

      // Now that we have received the first response message to our out of band invitation, we mark the out of band record as done
      outOfBandRecord.state = DidCommOutOfBandState.Done
      await outOfBandRepository.update(messageContext.agentContext, outOfBandRecord)
    } else {
      throw new CredoError(`Out of band record is in incorrect state ${outOfBandRecord.state}`)
    }
  }

  public async updateState(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    newState: DidCommDidExchangeState
  ) {
    const previousState = connectionRecord.state
    connectionRecord.state = newState
    await this.connectionRepository.update(agentContext, connectionRecord)

    this.emitStateChangedEvent(agentContext, connectionRecord, previousState)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    previousState: DidCommDidExchangeState | null
  ) {
    this.eventEmitter.emit<DidCommConnectionStateChangedEvent>(agentContext, {
      type: DidCommConnectionEventTypes.DidCommConnectionStateChanged,
      payload: {
        // Connection record in event should be static
        connectionRecord: connectionRecord.clone(),
        previousState,
      },
    })
  }

  public update(agentContext: AgentContext, connectionRecord: DidCommConnectionRecord) {
    return this.connectionRepository.update(agentContext, connectionRecord)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll(agentContext: AgentContext) {
    return this.connectionRepository.getAll(agentContext)
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(agentContext: AgentContext, connectionId: string): Promise<DidCommConnectionRecord> {
    return this.connectionRepository.getById(agentContext, connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(agentContext: AgentContext, connectionId: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findById(agentContext, connectionId)
  }

  /**
   * Delete a connection record by id
   *
   * @param connectionId the connection record id
   */
  public async deleteById(agentContext: AgentContext, connectionId: string) {
    const connectionRecord = await this.getById(agentContext, connectionId)
    return this.connectionRepository.delete(agentContext, connectionRecord)
  }

  public async findByDids(agentContext: AgentContext, query: { ourDid: string; theirDid: string }) {
    return this.connectionRepository.findByDids(agentContext, query)
  }

  /**
   * Retrieve a connection record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public async getByThreadId(agentContext: AgentContext, threadId: string): Promise<DidCommConnectionRecord> {
    return this.connectionRepository.getByThreadId(agentContext, threadId)
  }

  public async getByRoleAndThreadId(agentContext: AgentContext, role: DidCommDidExchangeRole, threadId: string) {
    return this.connectionRepository.getByRoleAndThreadId(agentContext, role, threadId)
  }

  public async findByTheirDid(agentContext: AgentContext, theirDid: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery(agentContext, { theirDid })
  }

  public async findByOurDid(agentContext: AgentContext, ourDid: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery(agentContext, { did: ourDid })
  }

  public async findAllByOutOfBandId(agentContext: AgentContext, outOfBandId: string) {
    return this.connectionRepository.findByQuery(agentContext, { outOfBandId })
  }

  public async findAllByConnectionTypes(
    agentContext: AgentContext,
    connectionTypes: Array<DidCommConnectionType | string>
  ) {
    return this.connectionRepository.findByQuery(agentContext, { connectionTypes })
  }

  public async findByInvitationDid(agentContext: AgentContext, invitationDid: string) {
    return this.connectionRepository.findByQuery(agentContext, { invitationDid })
  }

  public async findByKeys(
    agentContext: AgentContext,
    {
      senderKey,
      recipientKey,
    }: { senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>; recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> }
  ) {
    const theirDidRecord = await this.didRepository.findReceivedDidByRecipientKey(agentContext, senderKey)
    if (theirDidRecord) {
      const ourDidRecord = await this.didRepository.findCreatedDidByRecipientKey(agentContext, recipientKey)
      if (ourDidRecord) {
        const connectionRecord = await this.findByDids(agentContext, {
          ourDid: ourDidRecord.did,
          theirDid: theirDidRecord.did,
        })
        if (connectionRecord?.isReady) return connectionRecord
      }
    }

    this.logger.debug(
      `No connection record found for encrypted message with recipient key ${recipientKey.fingerprint} and sender key ${senderKey.fingerprint}`
    )

    return null
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommConnectionRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommConnectionRecord[]> {
    return this.connectionRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async createConnection(
    agentContext: AgentContext,
    options: DidCommConnectionRecordProps
  ): Promise<DidCommConnectionRecord> {
    const connectionRecord = new DidCommConnectionRecord(options)
    await this.connectionRepository.save(agentContext, connectionRecord)
    return connectionRecord
  }

  public async addConnectionType(agentContext: AgentContext, connectionRecord: DidCommConnectionRecord, type: string) {
    const connectionTypes = connectionRecord.connectionTypes || []
    connectionRecord.connectionTypes = [type, ...connectionTypes]
    await this.update(agentContext, connectionRecord)
  }

  public async removeConnectionType(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    type: string
  ) {
    connectionRecord.connectionTypes = connectionRecord.connectionTypes.filter((value) => value !== type)
    await this.update(agentContext, connectionRecord)
  }

  public async getConnectionTypes(connectionRecord: DidCommConnectionRecord) {
    return connectionRecord.connectionTypes || []
  }

  public async returnWhenIsConnected(
    agentContext: AgentContext,
    connectionId: string,
    timeoutMs = 20000
  ): Promise<DidCommConnectionRecord> {
    const isConnected = (connection: DidCommConnectionRecord) => {
      return connection.id === connectionId && connection.state === DidCommDidExchangeState.Completed
    }

    const observable = this.eventEmitter.observable<DidCommConnectionStateChangedEvent>(
      DidCommConnectionEventTypes.DidCommConnectionStateChanged
    )
    const subject = new ReplaySubject<DidCommConnectionRecord>(1)

    observable
      .pipe(
        filterContextCorrelationId(agentContext.contextCorrelationId),
        map((e) => e.payload.connectionRecord),
        first(isConnected), // Do not wait for longer than specified timeout
        timeout({
          first: timeoutMs,
          meta: 'DidCommConnectionService.returnWhenIsConnected',
        })
      )
      .subscribe(subject)

    const connection = await this.getById(agentContext, connectionId)
    if (isConnected(connection)) {
      subject.next(connection)
    }

    return firstValueFrom(subject)
  }
}

export interface ConnectionProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
  connectionRecord: DidCommConnectionRecord
}
