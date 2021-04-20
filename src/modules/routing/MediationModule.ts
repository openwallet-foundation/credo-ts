import { EventEmitter } from 'events'
import { AgentConfig } from '../../agent/AgentConfig'
import { MessagePickupService, MediationService } from './services'
import { MessageSender } from '../../agent/MessageSender'
import { ConnectionService, ConnectionState, ConnectionInvitationMessage } from '../connections'
import type { Verkey } from 'indy-sdk'
import { Dispatcher } from '../../agent/Dispatcher'
import {
  BatchHandler,
  BatchPickupHandler,
  ForwardHandler,
  KeylistUpdateHandler,
  KeylistUpdateResponseHandler,
} from './handlers'
import { Logger } from '../../logger'

export class RoutingModule {
  private agentConfig: AgentConfig
  private mediationService: MediationService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter
  private logger: Logger

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
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
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

    return agentConnectionAtMediator
  }
 */

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
