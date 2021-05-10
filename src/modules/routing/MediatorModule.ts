import type { Verkey } from 'indy-sdk'
import { EventEmitter } from 'events'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { ConnectionState } from '../connections/models'
import { KeylistUpdateHandler, ForwardHandler, BatchPickupHandler, BatchHandler } from './handlers'
import { MediatorService } from './services/MediatorService'
import { MessagePickupService } from './services/MessagePickupService'
import {
  ConnectionEventType,
  ConnectionInvitationMessage,
  ConnectionService,
  ConnectionStateChangedEvent,
} from '../connections'
import { MediationRecord } from '.'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'

export class MediatorModule {
  private agentConfig: AgentConfig
  private mediatorService: MediatorService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  public eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationService: MediatorService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.mediatorService = mediationService
    this.messagePickupService = messagePickupService
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the mediation service. Will emit events
   * when related messages are received.
   *
   * @returns event emitter for mediation-related received messages
   */
  public get events(): EventEmitter {
    return this.mediatorService
  }

  public async grantRequestedMediation(connectionRecord: ConnectionRecord, mediationRecord: MediationRecord) {
    const grantMessage = await this.mediatorService.createGrantMediationMessage(mediationRecord)
    const outboundMessage = createOutboundMessage(connectionRecord, grantMessage)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  // TODO - Belongs in connections.
  public async receiveMediation(
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

    // if auto accept is enabled (either on the record or the global agent config)
    // we directly send a connection request
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      connection = await this.acceptInvitation(connection.id)
    }

    return connection
  }

  // TODO - Belongs in connections.
  public async acceptInvitation(id: string): Promise<ConnectionRecord> {
    throw new Error('Method not implemented.')
  }

  // TODO - Belongs in connections.
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
  // TODO - Belongs in connections.
  public async acceptResponse(connectionId: string): Promise<ConnectionRecord> {
    const { message, connectionRecord: connectionRecord } = await this.connectionService.createTrustPing(connectionId)

    const outbound = createOutboundMessage(connectionRecord, message)
    await this.messageSender.sendMessage(outbound)

    return connectionRecord
  }

  // TODO - Belongs in connections.
  public async returnWhenIsConnected(connectionId: string): Promise<ConnectionRecord> {
    const isConnected = (connection: ConnectionRecord) => {
      return connection.id === connectionId && connection.state === ConnectionState.Complete
    }

    const connection = await this.connectionService.find(connectionId)
    if (connection && isConnected(connection)) return connection

    return new Promise((resolve) => {
      const listener = ({ connectionRecord: connectionRecord }: ConnectionStateChangedEvent) => {
        if (isConnected(connectionRecord)) {
          this.events.off(ConnectionEventType.StateChanged, listener)
          resolve(connectionRecord)
        }
      }

      this.events.on(ConnectionEventType.StateChanged, listener)
    })
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediatorService))
    dispatcher.registerHandler(new ForwardHandler(this.mediatorService))
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
    dispatcher.registerHandler(new MediationRequestHandler(this.mediatorService))
  }
}

interface MediatorConfiguration {
  verkey: Verkey
  invitationUrl: string
  alias?: string
}
