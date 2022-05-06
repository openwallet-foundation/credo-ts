import type { AcceptProtocol, Transport } from '../routing/types'
import type { OutOfBandInvitationMessage } from './messages/OutOfBandInvitationMessage'
import type { ConnectionRecord } from './repository/ConnectionRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'

import {
  ConnectionRequestHandler,
  ConnectionResponseHandler,
  AckMessageHandler,
  TrustPingMessageHandler,
  TrustPingResponseMessageHandler,
} from './handlers'
import { ConnectionInvitationMessage } from './messages'
import { ConnectionService } from './services/ConnectionService'
import { TrustPingService } from './services/TrustPingService'

@scoped(Lifecycle.ContainerScoped)
export class ConnectionsModule {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private trustPingService: TrustPingService
  private mediationRecipientService: MediationRecipientService

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    trustPingService: TrustPingService,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.trustPingService = trustPingService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
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

    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
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
    })
    // if auto accept is enabled (either on the record or the global agent config)
    // we directly send a connection request
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
    }
  ): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(
      connectionId,
      config
    )
    const outbound = createOutboundMessage(connectionRecord, message)
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
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createTrustPing(connectionId, {
      responseRequested: false,
    })

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  /**
   * Create Out-of-Band connection and invitation message.
   *
   * @param config config for creating invitation
   * @returns new connection record
   */
  public async createOutOfBandConnection(config?: {
    alias?: string
    myLabel?: string
    myImageUrl?: string
    goalCode?: string
    accept?: AcceptProtocol[]
    transport?: Transport
    autoAcceptConnection?: boolean
    mediatorId?: string
    useDefaultMediator?: boolean
    multiUseInvitation?: boolean
  }): Promise<{
    invitation: OutOfBandInvitationMessage
    connectionRecord: ConnectionRecord
  }> {
    const myRouting = await this.mediationRecipientService.getRouting({
      mediatorId: config?.mediatorId,
      useDefaultMediator: config?.useDefaultMediator,
      accept: config?.accept,
    })

    const { connectionRecord, message: invitation } = await this.connectionService.createOutOfBandConnection({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
      routing: myRouting,
      multiUseInvitation: config?.multiUseInvitation,
      myLabel: config?.myLabel,
      myImageUrl: config?.myImageUrl,
      goalCode: config?.goalCode,
      transport: config?.transport,
      accept: config?.accept,
    })
    return { connectionRecord, invitation }
  }

  /**
   * Create connection from received Out-of-Band invitation.
   *
   * @param invitation invitation to receive
   * @param config config for handling of invitation
   * @returns connection record
   */
  public async acceptOutOfBandInvitation(
    invitation: OutOfBandInvitationMessage,
    config?: {
      alias?: string
    }
  ): Promise<{
    connectionRecord: ConnectionRecord
  }> {
    const routing = await this.mediationRecipientService.getRouting({
      useDefaultMediator: true,
      accept: invitation.body?.accept,
    })

    const { connectionRecord } = await this.connectionService.acceptOutOfBandInvitation(invitation, {
      ...config,
      routing,
    })
    return { connectionRecord }
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

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerDIDCommV1Handler(
      new ConnectionRequestHandler(this.connectionService, this.agentConfig, this.mediationRecipientService)
    )
    dispatcher.registerDIDCommV1Handler(new ConnectionResponseHandler(this.connectionService, this.agentConfig))
    dispatcher.registerDIDCommV1Handler(new AckMessageHandler(this.connectionService))
    dispatcher.registerDIDCommV1Handler(new TrustPingMessageHandler(this.trustPingService, this.connectionService))
    dispatcher.registerDIDCommV1Handler(new TrustPingResponseMessageHandler(this.trustPingService))
  }
}
