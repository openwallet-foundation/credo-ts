import type { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { AckMessage } from '../../common'
import type { IndyAgentService } from '../../dids/domain/service'
import type { Transport } from '../../routing/types'
import type { ConnectionStateChangedEvent } from '../ConnectionEvents'
import type { ConnectionProblemReportMessage } from '../messages'
import type { CustomConnectionTags } from '../repository/ConnectionRecord'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import { AriesFrameworkError } from '../../../error'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'
import { Wallet } from '../../../wallet/Wallet'
import { DidCommService, DidDocument, DidResolverService } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { defaultAcceptProfiles, offlineTransports } from '../../routing/types'
import { ConnectionEventTypes } from '../ConnectionEvents'
import { ConnectionProblemReportError, ConnectionProblemReportReason } from '../errors'
import {
  ConnectionInvitationMessage,
  ConnectionRequestMessage,
  ConnectionResponseMessage,
  TrustPingMessage,
} from '../messages'
import { OutOfBandInvitationMessage } from '../messages/OutOfBandInvitationMessage'
import {
  authenticationTypes,
  Connection,
  ConnectionRole,
  ConnectionState,
  DidDoc,
  Ed25119Sig2018,
  ReferencedAuthentication,
} from '../models'
import { ConnectionRecord } from '../repository/ConnectionRecord'
import { ConnectionRepository } from '../repository/ConnectionRepository'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionService {
  private wallet: Wallet
  private config: AgentConfig
  private connectionRepository: ConnectionRepository
  private eventEmitter: EventEmitter
  private logger: Logger
  private didService: DidService
  private didResolverService: DidResolverService

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    connectionRepository: ConnectionRepository,
    eventEmitter: EventEmitter,
    didService: DidService,
    didResolverService: DidResolverService
  ) {
    this.wallet = wallet
    this.config = config
    this.connectionRepository = connectionRepository
    this.eventEmitter = eventEmitter
    this.logger = config.logger
    this.didService = didService
    this.didResolverService = didResolverService
  }

  /**
   * Create a new connection record containing a connection invitation message
   *
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async createInvitation(config: {
    routing: Routing
    autoAcceptConnection?: boolean
    alias?: string
    multiUseInvitation?: boolean
    myLabel?: string
    myImageUrl?: string
    transport?: Transport
  }): Promise<ConnectionProtocolMsgReturnType<ConnectionInvitationMessage>> {
    // TODO: public did
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Inviter,
      state: ConnectionState.Invited,
      alias: config?.alias,
      routing: config.routing,
      transport: config.transport,
      autoAcceptConnection: config?.autoAcceptConnection,
      multiUseInvitation: config.multiUseInvitation ?? false,
    })
    const { didDoc } = connectionRecord
    const [service] = didDoc.didCommServices
    const invitation = new ConnectionInvitationMessage({
      label: config?.myLabel ?? this.config.label,
      recipientKeys: service.recipientKeys,
      serviceEndpoint: service.serviceEndpoint,
      routingKeys: service.routingKeys,
      imageUrl: config?.myImageUrl ?? this.config.connectionImageUrl,
    })

    connectionRecord.invitation = invitation

    await this.connectionRepository.update(connectionRecord)

    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: connectionRecord,
        previousState: null,
      },
    })

    return { connectionRecord: connectionRecord, message: invitation }
  }

  /**
   * Process a received invitation message. This will not accept the invitation
   * or send an invitation request message. It will only create a connection record
   * with all the information about the invitation stored. Use {@link ConnectionService.createRequest}
   * after calling this function to create a connection request.
   *
   * @param invitation the invitation message to process
   * @returns new connection record.
   */
  public async processInvitation(
    invitation: ConnectionInvitationMessage,
    config: {
      routing: Routing
      autoAcceptConnection?: boolean
      alias?: string
    }
  ): Promise<ConnectionRecord> {
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Invitee,
      state: ConnectionState.Invited,
      alias: config?.alias,
      theirLabel: invitation.label,
      autoAcceptConnection: config?.autoAcceptConnection,
      routing: config.routing,
      invitation,
      imageUrl: invitation.imageUrl,
      tags: {
        invitationKey: invitation.recipientKeys && invitation.recipientKeys[0],
      },
      multiUseInvitation: false,
    })
    await this.connectionRepository.update(connectionRecord)
    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: connectionRecord,
        previousState: null,
      },
    })

    return connectionRecord
  }

  /**
   * Create a connection request message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection request
   * @param config config for creation of connection request
   * @returns outbound message containing connection request
   */
  public async createRequest(
    connectionId: string,
    config: {
      myLabel?: string
      myImageUrl?: string
      autoAcceptConnection?: boolean
    } = {}
  ): Promise<ConnectionProtocolMsgReturnType<ConnectionRequestMessage>> {
    const connectionRecord = await this.connectionRepository.getById(connectionId)

    connectionRecord.assertState(ConnectionState.Invited)
    connectionRecord.assertRole(ConnectionRole.Invitee)

    const { myLabel, myImageUrl, autoAcceptConnection } = config

    const connectionRequest = new ConnectionRequestMessage({
      label: myLabel ?? this.config.label,
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
      imageUrl: myImageUrl ?? this.config.connectionImageUrl,
    })

    if (autoAcceptConnection !== undefined || autoAcceptConnection !== null) {
      connectionRecord.autoAcceptConnection = config?.autoAcceptConnection
    }

    connectionRecord.autoAcceptConnection = config?.autoAcceptConnection
    await this.updateState(connectionRecord, ConnectionState.Requested)

    return {
      connectionRecord: connectionRecord,
      message: connectionRequest,
    }
  }

  /**
   * Process a received connection request message. This will not accept the connection request
   * or send a connection response message. It will only update the existing connection record
   * with all the new information from the connection request message. Use {@link ConnectionService.createResponse}
   * after calling this function to create a connection response.
   *
   * @param messageContext the message context containing a connection request message
   * @returns updated connection record
   */
  public async processRequest(
    messageContext: InboundMessageContext<ConnectionRequestMessage>,
    routing?: Routing
  ): Promise<ConnectionRecord> {
    const { message, recipient, sender } = messageContext

    if (!recipient || !sender) {
      throw new AriesFrameworkError('Unable to process connection request without senderKid or recipientKid')
    }

    let connectionRecord = await this.findByVerkey(recipient)
    if (!connectionRecord) {
      throw new AriesFrameworkError(
        `Unable to process connection request: connection for verkey ${recipient} not found`
      )
    }
    connectionRecord.assertState(ConnectionState.Invited)
    connectionRecord.assertRole(ConnectionRole.Inviter)

    if (!message.connection.didDoc) {
      throw new ConnectionProblemReportError('Public DIDs are not supported yet', {
        problemCode: ConnectionProblemReportReason.RequestNotAccepted,
      })
    }

    // Create new connection if using a multi use invitation
    if (connectionRecord.multiUseInvitation) {
      if (!routing) {
        throw new AriesFrameworkError(
          'Cannot process request for multi-use invitation without routing object. Make sure to call processRequest with the routing parameter provided.'
        )
      }

      connectionRecord = await this.createConnection({
        role: connectionRecord.role,
        state: connectionRecord.state,
        multiUseInvitation: false,
        routing,
        autoAcceptConnection: connectionRecord.autoAcceptConnection,
        invitation: connectionRecord.invitation,
        tags: connectionRecord.getTags(),
      })
    }

    connectionRecord.theirDidDoc = message.connection.didDoc
    connectionRecord.theirLabel = message.label
    connectionRecord.threadId = message.id
    connectionRecord.theirDid = message.connection.did
    connectionRecord.imageUrl = message.imageUrl

    if (!connectionRecord.theirKey) {
      throw new AriesFrameworkError(`Connection with id ${connectionRecord.id} has no recipient keys.`)
    }

    await this.updateState(connectionRecord, ConnectionState.Requested)

    return connectionRecord
  }

  /**
   * Create a connection response message for the connection with the specified connection id.
   *
   * @param connectionId the id of the connection for which to create a connection response
   * @returns outbound message containing connection response
   */
  public async createResponse(
    connectionId: string
  ): Promise<ConnectionProtocolMsgReturnType<ConnectionResponseMessage>> {
    const connectionRecord = await this.connectionRepository.getById(connectionId)

    connectionRecord.assertState(ConnectionState.Requested)
    connectionRecord.assertRole(ConnectionRole.Inviter)

    const connection = new Connection({
      did: connectionRecord.did,
      didDoc: connectionRecord.didDoc,
    })

    const connectionJson = JsonTransformer.toJSON(connection)

    if (!connectionRecord.threadId) {
      throw new AriesFrameworkError(`Connection record with id ${connectionId} does not have a thread id`)
    }

    // Use invitationKey by default, fall back to verkey
    const signingKey = (connectionRecord.getTag('invitationKey') as string) ?? connectionRecord.verkey

    const connectionResponse = new ConnectionResponseMessage({
      threadId: connectionRecord.threadId,
      connectionSig: await signData(connectionJson, this.wallet, signingKey),
    })

    await this.updateState(connectionRecord, ConnectionState.Responded)

    return {
      connectionRecord: connectionRecord,
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
    messageContext: InboundMessageContext<ConnectionResponseMessage>
  ): Promise<ConnectionRecord> {
    const { message, recipient, sender } = messageContext

    if (!recipient || !sender) {
      throw new AriesFrameworkError('Unable to process connection request without senderKid or recipientKid')
    }

    const connectionRecord = await this.findByVerkey(recipient)

    if (!connectionRecord) {
      throw new AriesFrameworkError(
        `Unable to process connection response: connection for verkey ${recipient} not found`
      )
    }

    connectionRecord.assertState(ConnectionState.Requested)
    connectionRecord.assertRole(ConnectionRole.Invitee)

    let connectionJson = null
    try {
      connectionJson = await unpackAndVerifySignatureDecorator(message.connectionSig, this.wallet)
    } catch (error) {
      if (error instanceof AriesFrameworkError) {
        throw new ConnectionProblemReportError(error.message, {
          problemCode: ConnectionProblemReportReason.RequestProcessingError,
        })
      }
    }

    const connection = JsonTransformer.fromJSON(connectionJson, Connection)
    await MessageValidator.validate(connection)

    // Per the Connection RFC we must check if the key used to sign the connection~sig is the same key
    // as the recipient key(s) in the connection invitation message
    const signerVerkey = message.connectionSig.signer
    const invitationKey = connectionRecord.getTags().invitationKey
    if (signerVerkey !== invitationKey) {
      throw new ConnectionProblemReportError(
        `Connection object in connection response message is not signed with same key as recipient key in invitation expected='${invitationKey}' received='${signerVerkey}'`,
        { problemCode: ConnectionProblemReportReason.ResponseNotAccepted }
      )
    }

    connectionRecord.theirDid = connection.did
    connectionRecord.theirDidDoc = connection.didDoc
    connectionRecord.threadId = message.threadId

    if (!connectionRecord.theirKey) {
      throw new AriesFrameworkError(`Connection with id ${connectionRecord.id} has no recipient keys.`)
    }

    await this.updateState(connectionRecord, ConnectionState.Responded)
    return connectionRecord
  }

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * By default a trust ping message should elicit a response. If this is not desired the
   * `config.responseRequested` property can be set to `false`.
   *
   * @param connectionId the id of the connection for which to create a trust ping message
   * @param config the config for the trust ping message
   * @returns outbound message containing trust ping message
   */
  public async createTrustPing(
    connectionId: string,
    config: { responseRequested?: boolean; comment?: string } = {}
  ): Promise<ConnectionProtocolMsgReturnType<TrustPingMessage>> {
    const connectionRecord = await this.connectionRepository.getById(connectionId)

    connectionRecord.assertState([ConnectionState.Responded, ConnectionState.Complete])

    // TODO:
    //  - create ack message
    //  - maybe this shouldn't be in the connection service?
    const trustPing = new TrustPingMessage(config)

    // Only update connection record and emit an event if the state is not already 'Complete'
    if (connectionRecord.state !== ConnectionState.Complete) {
      await this.updateState(connectionRecord, ConnectionState.Complete)
    }

    return {
      connectionRecord: connectionRecord,
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
    const { connection, recipient } = messageContext

    if (!recipient) {
      throw new AriesFrameworkError('Unable to process connection request without senderKid or recipientKid')
    }
    if (!connection) {
      throw new AriesFrameworkError(`Unable to process connection ack: connection for verkey ${recipient} not found`)
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (connection.state === ConnectionState.Responded && connection.role === ConnectionRole.Inviter) {
      await this.updateState(connection, ConnectionState.Complete)
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
    const { message: connectionProblemReportMessage, recipient, sender } = messageContext
    if (!recipient || !sender) {
      throw new AriesFrameworkError('Unable to process connection request without senderKid or recipientKid')
    }
    this.logger.debug(`Processing connection problem report for verkey ${recipient}`)

    if (!recipient) {
      throw new AriesFrameworkError('Unable to process connection problem report without recipientKid')
    }

    const connectionRecord = await this.findByVerkey(recipient)

    if (!connectionRecord) {
      throw new AriesFrameworkError(
        `Unable to process connection problem report: connection for verkey ${recipient} not found`
      )
    }

    if (connectionRecord.theirKey && connectionRecord.theirKey !== sender) {
      throw new AriesFrameworkError("Sender verkey doesn't match verkey of connection record")
    }

    connectionRecord.errorMessage = `${connectionProblemReportMessage.description.code} : ${connectionProblemReportMessage.description.en}`
    await this.update(connectionRecord)
    return connectionRecord
  }

  /**
   * Create a new Out-Of-Band connection
   *
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async createOutOfBandConnection(config: {
    goalCode?: string
    alias?: string
    myLabel?: string
    myImageUrl?: string
    autoAcceptConnection?: boolean
    multiUseInvitation?: boolean
    routing: Routing
    transport?: Transport
  }): Promise<{ connectionRecord: ConnectionRecord; message: OutOfBandInvitationMessage }> {
    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Inviter,
      state: ConnectionState.Complete,
      alias: config?.alias,
      routing: config.routing,
      autoAcceptConnection: config?.autoAcceptConnection,
      multiUseInvitation: config.multiUseInvitation ?? false,
      transport: config?.transport,
    })
    const invitation = new OutOfBandInvitationMessage({
      from: connectionRecord.didDoc.id,
      body: {
        label: config?.myLabel ?? this.config.label,
        goalCode: config?.goalCode,
        accept: defaultAcceptProfiles,
        imageUrl: config?.myImageUrl ?? this.config.connectionImageUrl,
        serviceEndpoint: config?.transport,
      },
    })

    connectionRecord.outOfBandInvitation = invitation

    await this.connectionRepository.update(connectionRecord)

    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: connectionRecord,
        previousState: null,
      },
    })

    return { connectionRecord: connectionRecord, message: invitation }
  }

  /**
   * Create a new connection record from received Out-Of-Band invitation
   *
   * @param invitation The record context containing a connection problem report record
   * @param config config for creation of connection and invitation
   * @returns new connection record
   */
  public async acceptOutOfBandInvitation(
    invitation: OutOfBandInvitationMessage,
    config: {
      alias?: string
      routing: Routing
    }
  ): Promise<{ connectionRecord: ConnectionRecord; message: OutOfBandInvitationMessage }> {
    if (!invitation.from) {
      throw new AriesFrameworkError(`Invalid Out-Of-Band invitation: 'from' field is missing`)
    }

    const connectionRecord = await this.createConnection({
      role: ConnectionRole.Invitee,
      state: ConnectionState.Complete,
      alias: config?.alias,
      outOfBandInvitation: invitation,
      theirLabel: invitation.body?.label,
      routing: config.routing,
      imageUrl: invitation.body?.imageUrl,
      multiUseInvitation: false,
    })
    const theirDIDDoc = await this.buildConnectionDIDDoc(invitation.from, connectionRecord.transport)

    connectionRecord.theirDid = theirDIDDoc.id
    connectionRecord.theirDidDoc = theirDIDDoc

    await this.connectionRepository.update(connectionRecord)
    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: connectionRecord,
        previousState: null,
      },
    })

    return { connectionRecord, message: invitation }
  }

  public async setOutOfBandConnectionTheirInfo(connectionRecord: ConnectionRecord, theirDid_: string): Promise<void> {
    if (!connectionRecord.isOutOfBandConnection) {
      throw new AriesFrameworkError(`Function can be used for Out-Of-Band connections only`)
    }

    const theirDid = DidDocument.extractDidFromKid(theirDid_)
    const theirDIDDoc = await this.buildConnectionDIDDoc(theirDid, connectionRecord.transport)

    connectionRecord.theirDid = theirDid
    connectionRecord.theirDidDoc = theirDIDDoc

    await this.update(connectionRecord)
  }

  public async buildConnectionDIDDoc(did: string, transport: Transport = 'nfc'): Promise<DidDoc> {
    const { didDocument: theirDidDocument } = await this.didResolverService.resolve(did)
    if (!theirDidDocument) {
      throw new AriesFrameworkError(`Invalid Out-Of-Band invitation: 'from' field is missing`)
    }

    const theirDidDoc = DidDoc.convertDIDDocToConnectionDIDDoc(theirDidDocument)
    const publicKey = theirDidDoc.publicKey[0]
    if (!publicKey.value) {
      throw new AriesFrameworkError(`Unable to resolve valid DIDDoc for DID: ${did}`)
    }

    const service = theirDidDoc.service.length
      ? theirDidDoc.service
      : [
          new DidCommService({
            id: `${did}#${transport}`,
            serviceEndpoint: transport,
            recipientKeys: [publicKey.value],
          }),
        ]

    return new DidDoc({
      id: did,
      authentication: theirDidDoc.authentication,
      service: service,
      publicKey: [publicKey],
    })
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
      previousSentMessage?: DIDCommV1Message
      previousReceivedMessage?: DIDCommV1Message
    } = {}
  ) {
    const { connection, message, recipient, sender } = messageContext

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

      if (previousSentMessage) {
        // If we have previously sent a message, it is not allowed to receive an OOB/unpacked record
        if (!recipient) {
          throw new AriesFrameworkError(
            'Cannot verify service without recipientKey on incoming message (received unpacked message)'
          )
        }

        // Check if the inbound message recipient key is present
        // in the recipientKeys of previously sent message ~service decorator
        if (!previousSentMessage?.service || !previousSentMessage.service.recipientKeys.includes(recipient)) {
          throw new AriesFrameworkError(
            'Previously sent message ~service recipientKeys does not include current received message recipient key'
          )
        }
      }

      if (previousReceivedMessage) {
        // If we have previously received a message, it is not allowed to receive an OOB/unpacked/AnonCrypt message
        if (!sender) {
          throw new AriesFrameworkError(
            'Cannot verify service without senderKey on incoming message (received AnonCrypt or unpacked message)'
          )
        }

        // Check if the inbound message sender key is present
        // in the recipientKeys of previously received message ~service decorator
        if (!previousReceivedMessage.service || !previousReceivedMessage.service.recipientKeys.includes(sender)) {
          throw new AriesFrameworkError(
            'Previously received message ~service recipientKeys does not include current received message sender key'
          )
        }
      }

      // If message is received unpacked/, we need to make sure it included a ~service decorator
      if (!message.serviceDecorator() && !recipient) {
        throw new AriesFrameworkError('Message recipientKey must have ~service decorator')
      }
    }
  }

  public async updateState(connectionRecord: ConnectionRecord, newState: ConnectionState) {
    const previousState = connectionRecord.state
    connectionRecord.state = newState
    await this.connectionRepository.update(connectionRecord)

    this.eventEmitter.emit<ConnectionStateChangedEvent>({
      type: ConnectionEventTypes.ConnectionStateChanged,
      payload: {
        connectionRecord: connectionRecord,
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

  /**
   * Find connection by my DID.
   *
   * @param did the did to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given did
   */
  public findByMyDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findByMyDid(did)
  }

  /**
   * Find connection by their DID.
   *
   * @param did the did to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given did
   */
  public findByTheirDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findByTheirDid(did)
  }

  /**
   * Find connection by verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByVerkey(verkey: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findByVerkey(verkey)
  }

  /**
   * Find connection by their verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByTheirKey(verkey: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findByTheirKey(verkey)
  }

  /**
   * Find connection by invitation key.
   *
   * @param key the invitation key to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByInvitationKey(key: string): Promise<ConnectionRecord | null> {
    return this.connectionRepository.findByInvitationKey(key)
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

  private async createConnection(options: {
    role: ConnectionRole
    state: ConnectionState
    invitation?: ConnectionInvitationMessage
    outOfBandInvitation?: OutOfBandInvitationMessage
    alias?: string
    routing: Routing
    theirLabel?: string
    autoAcceptConnection?: boolean
    multiUseInvitation: boolean
    tags?: CustomConnectionTags
    imageUrl?: string
    transport?: Transport
  }): Promise<ConnectionRecord> {
    const { endpoints, did, verkey, routingKeys, mediatorId } = options.routing

    const publicKey = new Ed25119Sig2018({
      id: `${did}#1`,
      controller: did,
      publicKeyBase58: verkey,
    })

    const serviceEndpoint = options.invitation?.serviceEndpoint || options.outOfBandInvitation?.body.serviceEndpoint
    const transport = options.transport || (serviceEndpoint?.split(':')[0] as Transport)

    let services: IndyAgentService[] | DidCommService[]
    if (transport && offlineTransports.includes(transport)) {
      services = [
        new DidCommService({
          id: `${did}#${transport}`,
          serviceEndpoint: transport,
          recipientKeys: [verkey],
        }),
      ]
    } else {
      services = endpoints.map(
        (endpoint, index) =>
          new DidCommService({
            id: `${did}#IndyAgentService`,
            serviceEndpoint: endpoint,
            recipientKeys: [verkey],
            routingKeys: routingKeys,

            // Order of endpoint determines priority
            priority: index,
          })
      )
    }

    // TODO: abstract the second parameter for ReferencedAuthentication away. This can be
    // inferred from the publicKey class instance
    const auth = new ReferencedAuthentication(publicKey, authenticationTypes[publicKey.type])

    const didDoc = new DidDoc({
      id: did,
      authentication: [auth],
      service: services,
      publicKey: [publicKey],
    })

    const connectionRecord = new ConnectionRecord({
      did,
      didDoc,
      verkey,
      state: options.state,
      role: options.role,
      tags: options.tags,
      invitation: options.invitation,
      outOfBandInvitation: options.outOfBandInvitation,
      alias: options.alias,
      theirLabel: options.theirLabel,
      autoAcceptConnection: options.autoAcceptConnection,
      imageUrl: options.imageUrl,
      multiUseInvitation: options.multiUseInvitation,
      mediatorId,
      transport,
    })

    await this.connectionRepository.save(connectionRecord)
    return connectionRecord
  }

  public async returnWhenIsConnected(connectionId: string, timeoutMs = 20000): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete
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
  verkey: string
  did: string
  routingKeys: string[]
  mediatorId?: string
}

export interface ConnectionProtocolMsgReturnType<MessageType extends DIDCommV1Message> {
  message: MessageType
  connectionRecord: ConnectionRecord
}
