import type { OutOfBandRecord } from '../oob/repository'
import type { ConnectionRecord } from './repository/ConnectionRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { DidCommService } from '../dids'
import { OutOfBandRepository } from '../oob/repository'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'

import { DidExchangeProtocol } from './DidExchangeProtocol'
import {
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  AckMessageHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
  DidExchangeRequestHandler,
  DidExchangeResponseHandler,
  DidExchangeCompleteHandler,
} from './handlers'
import { ConnectionInvitationMessage } from './messages'
import { HandshakeProtocol } from './models'
import { ConnectionService } from './services/ConnectionService'
import { TrustPingService } from './services/TrustPingService'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionsModule {
  private agentConfig: AgentConfig
  private didExchangeProtocol: DidExchangeProtocol
  private connectionService: ConnectionService
  private outOfBandRepository: OutOfBandRepository
  private messageSender: MessageSender
  private trustPingService: TrustPingService
  private mediationRecipientService: MediationRecipientService

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    didExchangeProtocol: DidExchangeProtocol,
    connectionService: ConnectionService,
    outOfBandRepository: OutOfBandRepository,
    trustPingService: TrustPingService,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.didExchangeProtocol = didExchangeProtocol
    this.connectionService = connectionService
    this.outOfBandRepository = outOfBandRepository
    this.trustPingService = trustPingService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  public async acceptInvitation2(
    outOfBandRecord: OutOfBandRecord,
    config?: {
      autoAcceptConnection?: boolean
      label?: string
      mediatorId?: string
    }
  ) {
    const routing = await this.mediationRecipientService.getRouting({ mediatorId: config?.mediatorId })
    const { message, connectionRecord } = await this.didExchangeProtocol.createRequest(outOfBandRecord, {
      label: config?.label || this.agentConfig.label,
      routing,
      autoAcceptConnection: config?.autoAcceptConnection,
    })
    await this.messageSender.sendMessageToService({
      message,
      service: new DidCommService(outOfBandRecord.outOfBandMessage.services[0] as DidCommService),
      senderKey: connectionRecord.verkey,
    })
    return connectionRecord
  }

  public async createConnection(config?: {
    autoAcceptConnection?: boolean
    alias?: string
    mediatorId?: string
    multiUseInvitation?: boolean
    myLabel?: string
    myImageUrl?: string
  }): Promise<{
    invitation: ConnectionInvitationMessage
    connectionRecord: ConnectionRecord
  }> {
    const myRouting = await this.mediationRecipientService.getRouting({
      mediatorId: config?.mediatorId,
      useDefaultMediator: true,
    })

    const { connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
      routing: myRouting,
      multiUseInvitation: config?.multiUseInvitation,
      myLabel: config?.myLabel,
      myImageUrl: config?.myImageUrl,
    })

    return { connectionRecord, invitation }
  }

  /**
   * Receive connection invitation as invitee and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationJson json object containing the invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitation(
    invitation: ConnectionInvitationMessage,
    config?: {
      autoAcceptConnection?: boolean
      alias?: string
      mediatorId?: string
    }
  ): Promise<ConnectionRecord> {
    const routing = await this.mediationRecipientService.getRouting({ mediatorId: config?.mediatorId })

    let connection = await this.connectionService.processInvitation(invitation, {
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
      routing,
      protocol: HandshakeProtocol.Connections,
    })

    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      connection = await this.acceptInvitation(connection.id)
    }

    return connection
  }

  /**
   * Receive connection invitation as invitee encoded as url and create connection. If auto accepting is enabled
   * via either the config passed in the function or the global agent config, a connection
   * request message will be send.
   *
   * @param invitationUrl url containing a base64 encoded invitation to receive
   * @param config config for handling of invitation
   * @returns new connection record
   */
  public async receiveInvitationFromUrl(
    invitationUrl: string,
    config?: {
      autoAcceptConnection?: boolean
      alias?: string
      mediatorId?: string
      protocol?: HandshakeProtocol
    }
  ): Promise<ConnectionRecord> {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
    return this.receiveInvitation(invitation, config)
  }

  /**
   * Accept a connection invitation as invitee (by sending a connection request message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connections is enabled.
   *
   * @param connectionId the id of the connection for which to accept the invitation
   * @returns connection record
   */
  public async acceptInvitation(
    connectionId: string,
    config?: {
      autoAcceptConnection?: boolean
      label: string
      mediatorId?: string
    }
  ): Promise<ConnectionRecord> {
    this.agentConfig.logger.debug('Accepting invitaion', { connectionId, config })
    const connectionRecord = await this.connectionService.getById(connectionId)

    const { message } = await this.connectionService.createRequest(connectionRecord, config)
    const outboundMessage = createOutboundMessage(connectionRecord, message)

    await this.messageSender.sendMessage(outboundMessage)
    return connectionRecord
  }

  /**
   * Accept a connection request as inviter (by sending a connection response message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the request
   * @returns connection record
   */
  public async acceptRequest(connectionId: string): Promise<ConnectionRecord> {
    const connectionRecord = await this.connectionService.getById(connectionId)

    let outboundMessage
    if (connectionRecord.protocol === HandshakeProtocol.DidExchange) {
      const message = await this.didExchangeProtocol.createResponse(connectionRecord)
      outboundMessage = createOutboundMessage(connectionRecord, message)
    } else {
      const { message } = await this.connectionService.createResponse(connectionRecord)
      outboundMessage = createOutboundMessage(connectionRecord, message)
    }

    await this.messageSender.sendMessage(outboundMessage)
    return connectionRecord
  }

  /**
   * Accept a connection response as invitee (by sending a trust ping message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId the id of the connection for which to accept the response
   * @returns connection record
   */
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const connectionRecord = await this.connectionService.getById(connectionId)

    let outboundMessage
    if (connectionRecord.protocol === HandshakeProtocol.DidExchange) {
      if (!connectionRecord.outOfBandId) {
        throw new AriesFrameworkError(`Connection ${connectionRecord.id} does not have outOfBandId!`)
      }
      const outOfBandRecord = await this.outOfBandRepository.findById(connectionRecord.outOfBandId)
      if (!outOfBandRecord) {
        throw new AriesFrameworkError(
          `OutOfBand record for connection ${connectionRecord.id} with outOfBandId ${connectionRecord.outOfBandId} not found!`
        )
      }
      const message = await this.didExchangeProtocol.createComplete(connectionRecord, outOfBandRecord)
      outboundMessage = createOutboundMessage(connectionRecord, message)
    } else {
      const { message } = await this.connectionService.createTrustPing(connectionRecord, {
        responseRequested: false,
      })
      outboundMessage = createOutboundMessage(connectionRecord, message)
    }

    await this.messageSender.sendMessage(outboundMessage)
    return connectionRecord
  }

  public async returnWhenIsConnected(connectionId: string, options?: { timeoutMs: number }): Promise<ConnectionRecord> {
    return this.connectionService.returnWhenIsConnected(connectionId, options?.timeoutMs)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll() {
    return this.connectionService.getAll()
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
    return this.connectionService.getById(connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findById(connectionId)
  }

  /**
   * Delete a connection record by id
   *
   * @param connectionId the connection record id
   */
  public async deleteById(connectionId: string) {
    return this.connectionService.deleteById(connectionId)
  }

  /**
   * Find connection by verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByVerkey(verkey: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findByVerkey(verkey)
  }

  /**
   * Find connection by their verkey.
   *
   * @param verkey the verkey to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByTheirKey(verkey: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirKey(verkey)
  }

  /**
   * Find connection by Invitation key.
   *
   * @param key the invitation key to search for
   * @returns the connection record, or null if not found
   * @throws {RecordDuplicateError} if multiple connections are found for the given verkey
   */
  public findByInvitationKey(key: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findByInvitationKey(key)
  }

  public async findByOutOfBandId(outOfBandId: string) {
    return this.connectionService.findByOutOfBandId(outOfBandId)
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
    return this.connectionService.getByThreadId(threadId)
  }

  public async findByDid(did: string): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirDid(did)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(
      new ConnectionRequestHandler(
        this.connectionService,
        this.outOfBandRepository,
        this.agentConfig,
        this.mediationRecipientService
      )
    )
    dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService, this.agentConfig))
    dispatcher.registerHandler(new AckMessageHandler(this.connectionService))
    dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService))
    dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService))

    dispatcher.registerHandler(
      new DidExchangeRequestHandler(
        this.didExchangeProtocol,
        this.outOfBandRepository,
        this.agentConfig,
        this.mediationRecipientService
      )
    )

    dispatcher.registerHandler(
      new DidExchangeResponseHandler(
        this.didExchangeProtocol,
        this.outOfBandRepository,
        this.connectionService,
        this.agentConfig
      )
    )
    dispatcher.registerHandler(new DidExchangeCompleteHandler(this.didExchangeProtocol, this.outOfBandRepository))
  }
}
