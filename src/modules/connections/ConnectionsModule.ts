import type { Verkey } from 'indy-sdk'
import { EventEmitter } from 'events'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionService, ConnectionEventType, ConnectionStateChangedEvent, TrustPingService } from './services'
import { MediationService } from '../routing'
import { ConnectionRecord } from './repository/ConnectionRecord'
import { ConnectionState } from './models'
import { ConnectionInvitationMessage } from './messages'
import {
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  AckMessageHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
} from './handlers'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'

export class ConnectionsModule {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private mediationService: MediationService
  private messageSender: MessageSender
  private trustPingService: TrustPingService

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    mediationService: MediationService,
    trustPingService: TrustPingService,
    messageSender: MessageSender,
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.trustPingService = trustPingService
    this.mediationService = mediationService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the connection service. Will emit state changed events
   * when the state of connections records changes.
   *
   * @returns event emitter for connection related state changes
   */
  public get events(): EventEmitter {
    return this.connectionService
  }

  public async createConnection(config?: {
    autoAcceptConnection?: boolean
    alias?: string
  }): Promise<{
    invitation: ConnectionInvitationMessage
    connectionRecord: ConnectionRecord
  }> {
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
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
    }
  ): Promise<ConnectionRecord> {
    let connection = await this.connectionService.processInvitation(invitation, {
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    })

    if (this.agentConfig.getEndpoint() == 'didcomm:transport/queue') {
      const {
        message: connectionRequest,
        connectionRecord: connectionRecord,
      } = await this.connectionService.createRequest(connection.id)

      const outboundMessage = createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)

      await this.messageSender.sendMessage(outboundMessage)
      await this.connectionService.returnWhenIsConnected(connectionRecord.id)
    } else {
      // if auto accept is enabled (either on the record or the global agent config)
      // we directly send a connection request
      if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
        connection = await this.acceptInvitation(connection.id)
      }
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
  public async acceptInvitation(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message, connectionRecord.invitation)
    await this.messageSender.sendMessage(outbound)

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
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createResponse(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

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
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createTrustPing(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionService.returnWhenIsConnected(connectionId)
  }

  public async getAll() {
    return this.connectionService.getConnections()
  }

  public async find(connectionId: string): Promise<ConnectionRecord | null> {
    return this.connectionService.find(connectionId)
  }

  public async getById(connectionId: string): Promise<ConnectionRecord> {
    return this.connectionService.getById(connectionId)
  }

  public async findConnectionByVerkey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByVerkey(verkey)
  }

  public async findConnectionByTheirKey(verkey: Verkey): Promise<ConnectionRecord | null> {
    return this.connectionService.findByTheirKey(verkey)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ConnectionRequestHandler(this.connectionService, this.agentConfig))
    dispatcher.registerHandler(new ConnectionResponseHandler(this.connectionService, this.agentConfig))
    dispatcher.registerHandler(new AckMessageHandler(this.connectionService))
    dispatcher.registerHandler(new TrustPingMessageHandler(this.trustPingService, this.connectionService))
    dispatcher.registerHandler(new TrustPingResponseMessageHandler(this.trustPingService))
  }
}
