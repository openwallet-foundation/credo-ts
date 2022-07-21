import type { AgentMessage } from '../../../agent/AgentMessage'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { AckMessage } from '../../common'
import type { OutOfBandDidCommService } from '../../oob/domain/OutOfBandDidCommService'
import type { OutOfBandRecord } from '../../oob/repository'
import type { ConnectionStateChangedEvent } from '../ConnectionEvents'
import type { ConnectionProblemReportMessage } from '../messages'
import type { ConnectionRecordProps } from '../repository/ConnectionRecord'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { AriesFrameworkError } from '../../../error'
import { inject, injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { indyDidFromPublicKeyBase58 } from '../../../utils/did'
import { Wallet } from '../../../wallet/Wallet'
import { DidKey, Key, IndyAgentService } from '../../dids'
import { DidDocumentRole } from '../../dids/domain/DidDocumentRole'
import { didKeyToVerkey } from '../../dids/helpers'
import { didDocumentJsonToNumAlgo1Did } from '../../dids/methods/peer/peerDidNumAlgo1'
import { DidRepository, DidRecord } from '../../dids/repository'
import { DidRecordMetadataKeys } from '../../dids/repository/didRecordMetadataTypes'
import { OutOfBandRole } from '../../oob/domain/OutOfBandRole'
import { OutOfBandState } from '../../oob/domain/OutOfBandState'
import { ConnectionEventTypes } from '../ConnectionEvents'
import { ConnectionProblemReportError, ConnectionProblemReportReason } from '../errors'
import { ConnectionRequestMessage, ConnectionResponseMessage, TrustPingMessage } from '../messages'
import {
  DidExchangeRole,
  DidExchangeState,
  Connection,
  DidDoc,
  Ed25119Sig2018,
  HandshakeProtocol,
  ReferencedAuthentication,
  authenticationTypes,
} from '../models'
import { ConnectionRecord } from '../repository/ConnectionRecord'
import { ConnectionRepository } from '../repository/ConnectionRepository'

import { convertToNewDidDocument } from './helpers'

export interface ConnectionRequestParams {
  label?: string
  imageUrl?: string
  alias?: string
  routing: Routing
  autoAcceptConnection?: boolean
}

@injectable()
export class ConnectionService {
  private wallet: Wallet
  private config: AgentConfig
  private connectionRepository: ConnectionRepository
  private didRepository: DidRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    connectionRepository: ConnectionRepository,
    didRepository: DidRepository,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.connectionRepository = connectionRepository
    this.didRepository = didRepository
    this.eventEmitter = eventEmitter
    this.logger = config.logger
  }

  /**
   * Create a connection request message for a given out-of-band.
   *
   * @param outOfBandRecord out-of-band record for which to create a connection request
   * @param config config for creation of connection request
   * @returns outbound message containing connection request
   */
  public async createRequest(
    outOfBandRecord: OutOfBandRecord,
    config: ConnectionRequestParams
  ): Promise<ConnectionProtocolMsgReturnType<ConnectionRequestMessage>> {
    this.logger.debug(`Create message ${ConnectionRequestMessage.type.messageTypeUri} start`, outOfBandRecord)
    outOfBandRecord.assertRole(OutOfBandRole.Receiver)
    outOfBandRecord.assertState(OutOfBandState.PrepareResponse)

    // TODO check there is no connection record for particular oob record

    const { outOfBandInvitation } = outOfBandRecord

    const { mediatorId } = config.routing
    const didDoc = this.createDidDoc(config.routing)

    // TODO: We should store only one did that we'll use to send the request message with success.
    // We take just the first one for now.
    const [invitationDid] = outOfBandInvitation.invitationDids

    const { did: peerDid } = await this.createDid({
      role: DidDocumentRole.Created,
      didDoc,
    })

    const { label, imageUrl } = config
    const connectionRequest = new ConnectionRequestMessage({
      label: label ?? this.config.label,
      did: didDoc.id,
      didDoc,
      imageUrl: imageUrl ?? this.config.connectionImageUrl,
    })

    connectionRequest.setThread({
      threadId: connectionRequest.id,
      parentThreadId: outOfBandInvitation.id,
    })

    const connectionRecord = await this.createConnection({
      protocol: HandshakeProtocol.Connections,
      role: DidExchangeRole.Requester,
      state: DidExchangeState.InvitationReceived,
      theirLabel: outOfBandInvitation.label,
      alias: config?.alias,
      did: peerDid,
      mediatorId,
      autoAcceptConnection: config?.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
      invitationDid,
      imageUrl: outOfBandInvitation.imageUrl,
      threadId: connectionRequest.id,
    })

    await this.updateState(connectionRecord, DidExchangeState.RequestSent)

    return {
      connectionRecord,
      message: connectionRequest,
    }
  }

  public async processRequest(
    messageContext: InboundMessageContext<ConnectionRequestMessage>,
    outOfBandRecord: OutOfBandRecord
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${ConnectionRequestMessage.type.messageTypeUri} start`, messageContext)
    outOfBandRecord.assertRole(OutOfBandRole.Sender)
    outOfBandRecord.assertState(OutOfBandState.AwaitResponse)

    // TODO check there is no connection record for particular oob record

    const { message } = messageContext
    if (!message.connection.didDoc) {
      throw new ConnectionProblemReportError('Public DIDs are not supported yet', {
        problemCode: ConnectionProblemReportReason.RequestNotAccepted,
      })
    }

    const { did: peerDid } = await this.createDid({
      role: DidDocumentRole.Received,
      didDoc: message.connection.didDoc,
    })

    const connectionRecord = await this.createConnection({
      protocol: HandshakeProtocol.Connections,
      role: DidExchangeRole.Responder,
      state: DidExchangeState.RequestReceived,
      theirLabel: message.label,
      imageUrl: message.imageUrl,
      outOfBandId: outOfBandRecord.id,
      theirDid: peerDid,
      threadId: message.threadId,
      mediatorId: outOfBandRecord.mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
    })

    await this.connectionRepository.update(connectionRecord)
    this.emitStateChangedEvent(connectionRecord, null)

    this.logger.debug(`Process message ${ConnectionRequestMessage.type.messageTypeUri} end`, connectionRecord)
    return connectionRecord
  }

  /**
   * Create a connection response message for the connection with the specified connection id.
   *
   * @param connectionRecord the connection for which to create a connection response
   * @returns outbound message containing connection response
   */
  public async createResponse(
    connectionRecord: ConnectionRecord,
    outOfBandRecord: OutOfBandRecord,
    routing?: Routing
  ): Promise<ConnectionProtocolMsgReturnType<ConnectionResponseMessage>> {
    this.logger.debug(`Create message ${ConnectionResponseMessage.type.messageTypeUri} start`, connectionRecord)
    connectionRecord.assertState(DidExchangeState.RequestReceived)
    connectionRecord.assertRole(DidExchangeRole.Responder)

    const didDoc = routing
      ? this.createDidDoc(routing)
      : this.createDidDocFromOutOfBandDidCommServices(outOfBandRecord.outOfBandInvitation.getInlineServices())

    const { did: peerDid } = await this.createDid({
      role: DidDocumentRole.Created,
      didDoc,
    })

    const connection = new Connection({
      did: didDoc.id,
      didDoc,
    })

    const connectionJson = JsonTransformer.toJSON(connection)

    if (!connectionRecord.threadId) {
      throw new AriesFrameworkError(`Connection record with id ${connectionRecord.id} does not have a thread id`)
    }

    const signingKey = Key.fromFingerprint(outOfBandRecord.getTags().recipientKeyFingerprints[0]).publicKeyBase58

    const connectionResponse = new ConnectionResponseMessage({
      threadId: connectionRecord.threadId,
      connectionSig: await signData(connectionJson, this.wallet, signingKey),
    })

    connectionRecord.did = peerDid
    await this.updateState(connectionRecord, DidExchangeState.ResponseSent)

    this.logger.debug(`Create message ${ConnectionResponseMessage.type.messageTypeUri} end`, {
      connectionRecord,
      message: connectionResponse,
    })
    return {
      connectionRecord,
      message: connectionResponse,
    }
  }

  /**
   * Process a received connection response message. This will not accept the connection request
   * or send a connection acknowledgement message. It will only update the existing connection record
   * with all the new information from the connection response message. Use {@link ConnectionService.createTrustPing}
   * after calling this function to create a trust ping message.
   *
   * @param messageContext the message context containing a connection response message
   * @returns updated connection record
   */
  public async processResponse(
    messageContext: InboundMessageContext<ConnectionResponseMessage>,
    outOfBandRecord: OutOfBandRecord
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${ConnectionResponseMessage.type.messageTypeUri} start`, messageContext)
    const { connection: connectionRecord, message, recipientKey, senderKey } = messageContext

    if (!recipientKey || !senderKey) {
      throw new AriesFrameworkError('Unable to process connection request without senderKey or recipientKey')
    }

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    connectionRecord.assertState(DidExchangeState.RequestSent)
    connectionRecord.assertRole(DidExchangeRole.Requester)

    let connectionJson = null
    try {
      connectionJson = await unpackAndVerifySignatureDecorator(message.connectionSig, this.wallet)
    } catch (error) {
      if (error instanceof AriesFrameworkError) {
        throw new ConnectionProblemReportError(error.message, {
          problemCode: ConnectionProblemReportReason.ResponseProcessingError,
        })
      }
      throw error
    }

    const connection = JsonTransformer.fromJSON(connectionJson, Connection)

    // Per the Connection RFC we must check if the key used to sign the connection~sig is the same key
    // as the recipient key(s) in the connection invitation message
    const signerVerkey = message.connectionSig.signer

    const invitationKey = Key.fromFingerprint(outOfBandRecord.getTags().recipientKeyFingerprints[0]).publicKeyBase58

    if (signerVerkey !== invitationKey) {
      throw new ConnectionProblemReportError(
        `Connection object in connection response message is not signed with same key as recipient key in invitation expected='${invitationKey}' received='${signerVerkey}'`,
        { problemCode: ConnectionProblemReportReason.ResponseNotAccepted }
      )
    }

    if (!connection.didDoc) {
      throw new AriesFrameworkError('DID Document is missing.')
    }

    const { did: peerDid } = await this.createDid({
      role: DidDocumentRole.Received,
      didDoc: connection.didDoc,
    })

    connectionRecord.theirDid = peerDid
    connectionRecord.threadId = message.threadId

    await this.updateState(connectionRecord, DidExchangeState.ResponseReceived)
    return connectionRecord
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
    connectionRecord: ConnectionRecord,
    config: { responseRequested?: boolean; comment?: string } = {}
  ): Promise<ConnectionProtocolMsgReturnType<TrustPingMessage>> {
    connectionRecord.assertState([DidExchangeState.ResponseReceived, DidExchangeState.Completed])

    // TODO:
    //  - create ack message
    //  - maybe this shouldn't be in the connection service?
    const trustPing = new TrustPingMessage(config)

    // Only update connection record and emit an event if the state is not already 'Complete'
    if (connectionRecord.state !== DidExchangeState.Completed) {
      await this.updateState(connectionRecord, DidExchangeState.Completed)
    }

    return {
      connectionRecord,
      message: trustPing,
    }
  }

  /**
   * Process a received ack message. This will update the state of the connection
   * to Completed if this is not already the case.
   *
   * @param messageContext the message context containing an ack message
   * @returns updated connection record
   */
  public async processAck(messageContext: InboundMessageContext<AckMessage>): Promise<ConnectionRecord> {
    const { connection, recipientKey } = messageContext

    if (!connection) {
      throw new AriesFrameworkError(
        `Unable to process connection ack: connection for recipient key ${recipientKey?.fingerprint} not found`
      )
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === DidExchangeState.ResponseSent && connection.role === DidExchangeRole.Responder) {
      await this.updateState(connection, DidExchangeState.Completed)
    }

    return connection
  }

  /**
   * Process a received {@link ProblemReportMessage}.
   *
   * @param messageContext The message context containing a connection problem report message
   * @returns connection record associated with the connection problem report message
   *
   */
  public async processProblemReport(
    messageContext: InboundMessageContext<ConnectionProblemReportMessage>
  ): Promise<ConnectionRecord> {
    const { message: connectionProblemReportMessage, recipientKey, senderKey } = messageContext

    this.logger.debug(`Processing connection problem report for verkey ${recipientKey?.fingerprint}`)

    if (!recipientKey) {
      throw new AriesFrameworkError('Unable to process connection problem report without recipientKey')
    }

    let connectionRecord
    const ourDidRecords = await this.didRepository.findAllByRecipientKey(recipientKey)
    for (const ourDidRecord of ourDidRecords) {
      connectionRecord = await this.findByOurDid(ourDidRecord.id)
    }

    if (!connectionRecord) {
      throw new AriesFrameworkError(
        `Unable to process connection problem report: connection for recipient key ${recipientKey.fingerprint} not found`
      )
    }

    const theirDidRecord = connectionRecord.theirDid && (await this.didRepository.findById(connectionRecord.theirDid))
    if (!theirDidRecord) {
      throw new AriesFrameworkError(`Did record with id ${connectionRecord.theirDid} not found.`)
    }

    if (senderKey) {
      if (!theirDidRecord?.getTags().recipientKeyFingerprints?.includes(senderKey.fingerprint)) {
        throw new AriesFrameworkError("Sender key doesn't match key of connection record")
      }
    }

    connectionRecord.errorMessage = `${connectionProblemReportMessage.description.code} : ${connectionProblemReportMessage.description.en}`
    await this.update(connectionRecord)
    return connectionRecord
  }

  /**
   * Assert that an inbound message either has a connection associated with it,
   * or has everything correctly set up for connection-less exchange.
   *
   * @param messageContext - the inbound message context
   * @param previousRespondence - previous sent and received message to determine if a valid service decorator is present
   */
  public assertConnectionOrServiceDecorator(
    messageContext: InboundMessageContext,
    {
      previousSentMessage,
      previousReceivedMessage,
    }: {
      previousSentMessage?: AgentMessage
      previousReceivedMessage?: AgentMessage
    } = {}
  ) {
    const { connection, message } = messageContext

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

      const recipientKey = messageContext.recipientKey && messageContext.recipientKey.publicKeyBase58
      const senderKey = messageContext.senderKey && messageContext.senderKey.publicKeyBase58

      if (previousSentMessage) {
        // If we have previously sent a message, it is not allowed to receive an OOB/unpacked message
        if (!recipientKey) {
          throw new AriesFrameworkError(
            'Cannot verify service without recipientKey on incoming message (received unpacked message)'
          )
        }

        // Check if the inbound message recipient key is present
        // in the recipientKeys of previously sent message ~service decorator
        if (!previousSentMessage?.service || !previousSentMessage.service.recipientKeys.includes(recipientKey)) {
          throw new AriesFrameworkError(
            'Previously sent message ~service recipientKeys does not include current received message recipient key'
          )
        }
      }

      if (previousReceivedMessage) {
        // If we have previously received a message, it is not allowed to receive an OOB/unpacked/AnonCrypt message
        if (!senderKey) {
          throw new AriesFrameworkError(
            'Cannot verify service without senderKey on incoming message (received AnonCrypt or unpacked message)'
          )
        }

        // Check if the inbound message sender key is present
        // in the recipientKeys of previously received message ~service decorator
        if (!previousReceivedMessage.service || !previousReceivedMessage.service.recipientKeys.includes(senderKey)) {
          throw new AriesFrameworkError(
            'Previously received message ~service recipientKeys does not include current received message sender key'
          )
        }
      }

      // If message is received unpacked/, we need to make sure it included a ~service decorator
      if (!message.service && !recipientKey) {
        throw new AriesFrameworkError('Message recipientKey must have ~service decorator')
      }
    }
  }

  public async updateState(connectionRecord: ConnectionRecord, newState: DidExchangeState) {
    const previousState = connectionRecord.state
    connectionRecord.state = newState
    await this.connectionRepository.update(connectionRecord)

    this.emitStateChangedEvent(connectionRecord, previousState)
  }

  private emitStateChangedEvent(connectionRecord: ConnectionRecord, previousState: DidExchangeState | null) {
    // Connection record in event should be static
    const clonedConnection = JsonTransformer.clone(connectionRecord)

    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: clonedConnection,
        previousState,
      },
    })
  }

  public update(connectionRecord: ConnectionRecord) {
    return this.connectionRepository.update(connectionRecord)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll() {
    return this.connectionRepository.getAll()
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionRepository.getById(connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findById(connectionId)
  }

  /**
   * Delete a connection record by id
   *
   * @param connectionId the connection record id
   */
  public async deleteById(connectionId: string) {
    const connectionRecord = await this.getById(connectionId)
    return this.connectionRepository.delete(connectionRecord)
  }

  public async findSingleByQuery(query: { did: string; theirDid: string }) {
    return this.connectionRepository.findSingleByQuery(query)
  }

  /**
   * Retrieve a connection record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public getByThreadId(threadId: string): Promise<ConnectionRecord> {
    return this.connectionRepository.getByThreadId(threadId)
  }

  public async findByTheirDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery({ theirDid: did })
  }

  public async findByOurDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery({ did })
  }

  public async findAllByOutOfBandId(outOfBandId: string) {
    return this.connectionRepository.findByQuery({ outOfBandId })
  }

  public async findByInvitationDid(invitationDid: string) {
    return this.connectionRepository.findByQuery({ invitationDid })
  }

  public async createConnection(options: ConnectionRecordProps): Promise<ConnectionRecord> {
    const connectionRecord = new ConnectionRecord(options)
    await this.connectionRepository.save(connectionRecord)
    return connectionRecord
  }

  private async createDid({ role, didDoc }: { role: DidDocumentRole; didDoc: DidDoc }) {
    // Convert the legacy did doc to a new did document
    const didDocument = convertToNewDidDocument(didDoc)

    const peerDid = didDocumentJsonToNumAlgo1Did(didDocument.toJSON())
    didDocument.id = peerDid
    const didRecord = new DidRecord({
      id: peerDid,
      role,
      didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
      },
    })

    // Store the unqualified did with the legacy did document in the metadata
    // Can be removed at a later stage if we know for sure we don't need it anymore
    didRecord.metadata.set(DidRecordMetadataKeys.LegacyDid, {
      unqualifiedDid: didDoc.id,
      didDocumentString: JsonTransformer.serialize(didDoc),
    })

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(didRecord)
    this.logger.debug('Did record created.', didRecord)
    return { did: peerDid, didDocument }
  }

  private createDidDoc(routing: Routing) {
    const indyDid = indyDidFromPublicKeyBase58(routing.recipientKey.publicKeyBase58)

    const publicKey = new Ed25119Sig2018({
      id: `${indyDid}#1`,
      controller: indyDid,
      publicKeyBase58: routing.recipientKey.publicKeyBase58,
    })

    const auth = new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)

    // IndyAgentService is old service type
    const services = routing.endpoints.map(
      (endpoint, index) =>
        new IndyAgentService({
          id: `${indyDid}#IndyAgentService`,
          serviceEndpoint: endpoint,
          recipientKeys: [routing.recipientKey.publicKeyBase58],
          routingKeys: routing.routingKeys.map((key) => key.publicKeyBase58),
          // Order of endpoint determines priority
          priority: index,
        })
    )

    return new DidDoc({
      id: indyDid,
      authentication: [auth],
      service: services,
      publicKey: [publicKey],
    })
  }

  private createDidDocFromOutOfBandDidCommServices(services: OutOfBandDidCommService[]) {
    const [recipientDidKey] = services[0].recipientKeys

    const recipientKey = DidKey.fromDid(recipientDidKey).key
    const did = indyDidFromPublicKeyBase58(recipientKey.publicKeyBase58)

    const publicKey = new Ed25119Sig2018({
      id: `${did}#1`,
      controller: did,
      publicKeyBase58: recipientKey.publicKeyBase58,
    })

    const auth = new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)

    // IndyAgentService is old service type
    const service = services.map(
      (service, index) =>
        new IndyAgentService({
          id: `${did}#IndyAgentService`,
          serviceEndpoint: service.serviceEndpoint,
          recipientKeys: [recipientKey.publicKeyBase58],
          routingKeys: service.routingKeys?.map(didKeyToVerkey),
          priority: index,
        })
    )

    return new DidDoc({
      id: did,
      authentication: [auth],
      service,
      publicKey: [publicKey],
    })
  }

  public async returnWhenIsConnected(connectionId: string, timeoutMs = 20000): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === DidExchangeState.Completed
    }

    const observable = this.eventEmitter.observable<ConnectionStateChangedEvent>(
      ConnectionEventTypes.ConnectionStateChanged
    )
    const subject = new ReplaySubject<ConnectionRecord>(1)

    observable
      .pipe(
        map((e) => e.payload.connectionRecord),
        first(isConnected), // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .subscribe(subject)

    const connection = await this.getById(connectionId)
    if (isConnected(connection)) {
      subject.next(connection)
    }

    return firstValueFrom(subject)
  }
}

export interface Routing {
  endpoints: string[]
  recipientKey: Key
  routingKeys: Key[]
  mediatorId?: string
}

export interface ConnectionProtocolMsgReturnType<MessageType extends AgentMessage> {
  message: MessageType
  connectionRecord: ConnectionRecord
}
