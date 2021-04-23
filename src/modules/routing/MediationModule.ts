import type { Verkey } from 'indy-sdk'
import { EventEmitter } from 'events'

import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { ConnectionState } from '../connections/models'
import { RequestMediationMessage } from './messages'
import { KeylistUpdateHandler,ForwardHandler,BatchPickupHandler,BatchHandler } from './handlers'
import { MediationService } from './services/MediationService'
import { MessagePickupService } from './services/MessagePickupService'
import { ConnectionEventType, ConnectionInvitationMessage, ConnectionService, ConnectionStateChangedEvent } from '../connections'

export class MediationModule {
  private agentConfig: AgentConfig
  private mediationService: MediationService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationService: MediationService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.mediationService = mediationService
    this.messagePickupService = messagePickupService
    this.mediationService = mediationService
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }
/*   public async provision(mediatorConfiguration: MediatorConfiguration) {
    let mediationService = await this.mediationService.find()

    if (!provisioningRecord) {
      this.logger.info('No provision record found. Creating connection with mediator.')
      const { verkey, invitationUrl, alias = 'Mediator' } = mediatorConfiguration
      const mediatorInvitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)

      const connectionRecord = await this.connectionService.processInvitation(mediatorInvitation, { alias })
      const { message: connectionRequest } = await this.connectionService.createRequest(connectionRecord.id)

      const outboundMessage = createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)

      await this.messageSender.sendMessage(outboundMessage)
      await this.connectionService.returnWhenIsConnected(connectionRecord.id)

      const provisioningProps = {
        mediatorConnectionId: connectionRecord.id,
        mediatorPublicVerkey: verkey,
      }
      provisioningRecord = await this.provisioningService.create(provisioningProps)
      this.logger.debug('Provisioning record has been saved.')
    }

    this.logger.debug('Provisioning record:', provisioningRecord)

    const agentConnectionAtMediator = await this.connectionService.find(provisioningRecord.mediatorConnectionId)

    if (!agentConnectionAtMediator) {
      throw new Error('Connection not found!')
    }
    this.logger.debug('agentConnectionAtMediator', agentConnectionAtMediator)

    agentConnectionAtMediator.assertState(ConnectionState.Complete)

    this.agentConfig.establishInbound({
      verkey: mediationRecord.mediatorPublicVerkey,
      connection: agentConnectionAtMediator,
    })

    return agentConnectionAtMediator*/
  
  public get events(): EventEmitter {
    return this.mediationService
  }

  // Pass in a connectionRecord, recieve back the connectionRecord and a message
  public async requestMediation(config?: {
    autoAcceptConnection?: boolean
    alias?: string
  }): Promise<{ invitation: RequestMediationMessage; connectionRecord: ConnectionRecord }> {
    const { connectionRecord: connectionRecord, message: invitation } = await this.connectionService.createInvitation({
      autoAcceptConnection: config?.autoAcceptConnection,
      alias: config?.alias,
    })

    // How does this fit in with mediation?
    if (this.agentConfig.inboundConnection) {
      this.mediationService.createRoute(connectionRecord.verkey)
    }

    return { connectionRecord, invitation }
  }

  // TODO - Belongs in connections.
   public async receiveMediation(
     invitation: ConnectionInvitationMessage,
     config?: {
       autoAcceptConnection?: boolean;
       alias?: string;
     }
   ): Promise<ConnectionRecord> {
     let connection = await this.connectionService.processInvitation(invitation, {
       autoAcceptConnection: config?.autoAcceptConnection,
       alias: config?.alias,
     });

     // if auto accept is enabled (either on the record or the global agent config)
     // we directly send a connection request
     if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
       connection = await this.acceptInvitation(connection.id);
     }

     return connection;
   }

  acceptInvitation(id: string): ConnectionRecord | PromiseLike<ConnectionRecord> {
    throw new Error('Method not implemented.')
  }

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


  public getRoutingTable() {
    return this.mediationService.getRoutes()
  }

  public addRoute(route: string) {
    //return this.mediationService.create({connectionId})
  }

  public getInboundConnection() {
    return this.agentConfig.inboundConnection
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.mediationService))
    //dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new ForwardHandler(this.mediationService))
    // TODO: separate recipient handler for batch.
    dispatcher.registerHandler(new BatchPickupHandler(this.messagePickupService))
    dispatcher.registerHandler(new BatchHandler(this.eventEmitter))
  }
}

interface MediatorConfiguration {
  verkey: Verkey
  invitationUrl: string
  alias?: string
}
