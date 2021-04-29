import { AgentConfig } from '../../agent/AgentConfig'
import { MessagePickupService, MediationRecipientService } from './services'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import {
  ConnectionService,
  ConnectionState,
  ConnectionInvitationMessage,
  ConnectionResponseMessage,
} from '../connections'
import { BatchMessage } from './messages'
import type { Verkey } from 'indy-sdk'
import { Dispatcher } from '../../agent/Dispatcher'
import { KeylistUpdateHandler, MediationGrantedHandler, MediationDeniedHandler } from './handlers'
import { ConnectionRecord } from '../connections'
import agentConfig from '../../../samples/config'
import { EventEmitter } from 'events'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'

export class MediationRecipientModule {
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.messagePickupService = messagePickupService
    this.connectionService = connectionService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  // public async provision(mediatorConfiguration: MediatorConfiguration) {
  //   let provisioningRecord = await this.mediationRecipientService.find()

  //   if (!provisioningRecord) {
  //     this.logger.info('No provision record found. Creating connection with mediator.')
  //     const { verkey, invitationUrl, alias = 'Mediator' } = mediatorConfiguration
  //     const mediatorInvitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)

  //     const connectionRecord = await this.connectionService.processInvitation(mediatorInvitation, { alias })
  //     const { message: connectionRequest } = await this.connectionService.createRequest(connectionRecord.id)

  //     const outboundMessage = createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation)
  //     outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)

  //     await this.messageSender.sendMessage(outboundMessage)
  //     await this.connectionService.returnWhenIsConnected(connectionRecord.id)

  //     const provisioningProps = {
  //       mediatorConnectionId: connectionRecord.id,
  //       mediatorPublicVerkey: verkey,
  //     }
  //     provisioningRecord = await this.provisioningService.create(provisioningProps)
  //     this.logger.debug('Provisioning record has been saved.')
  //   }

  //   this.logger.debug('Provisioning record:', provisioningRecord)

  //   const agentConnectionAtMediator = await this.connectionService.find(provisioningRecord.mediatorConnectionId)

  //   if (!agentConnectionAtMediator) {
  //     throw new Error('Connection not found!')
  //   }
  //   this.logger.debug('agentConnectionAtMediator', agentConnectionAtMediator)

  //   agentConnectionAtMediator.assertState(ConnectionState.Complete)

  //   this.agentConfig.establishInbound({
  //     verkey: provisioningRecord.mediatorPublicVerkey,
  //     connection: agentConnectionAtMediator,
  //   })

  //   return agentConnectionAtMediator
  // }

  public async downloadMessages(mediatorConnection?: ConnectionRecord) {
    const inboundConnection = mediatorConnection
      ? { verkey: mediatorConnection.theirKey!, connection: mediatorConnection }
      : this.getInboundConnection()

    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  public async requestMediation(connection: ConnectionRecord) {
    const outboundMessage = await this.mediationRecipientService.requestMediation(connection)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public getInboundConnection() {
    return this.agentConfig.inboundConnection
  }

  public async listMediators() {
    return await this.mediationRecipientService.getMediators()
  }

  public async getDefaultMediatorId() {
    return this.mediationRecipientService.getDefaultMediatorId()
  }

  public async getDefaultMediator() {
    const mediatorId: string | undefined = this.mediationRecipientService.getDefaultMediatorId()
    if (mediatorId !== undefined) {
      return this.mediationRecipientService.fetchMediatorById(mediatorId)
    }
    return undefined
  }

  public async keylistUpdate() {}

  public async keylistquery() {}

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantedHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDeniedHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationRecipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationRecipientService))
  }
}

interface MediatorConfiguration {
  verkey: Verkey
  invitationUrl: string
  alias?: string
}
