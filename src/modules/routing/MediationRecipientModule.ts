import { AgentConfig } from '../../agent/AgentConfig';
import { MessagePickupService, MediationRecipientService } from './services';
import { MessageSender } from '../../agent/MessageSender';
import { createOutboundMessage } from '../../agent/helpers';
import {
  ConnectionService,
  ConnectionState,
  ConnectionInvitationMessage,
  ConnectionResponseMessage,
} from '../connections';
import { BatchMessage } from './messages';
import type { Verkey } from 'indy-sdk';
import { Dispatcher } from '../../agent/Dispatcher';
import { KeylistUpdateHandler, MediationGrantedHandler, MediationDeniedHandler } from './handlers';
import { ConnectionRecord } from '../connections';
import agentConfig from '../../../samples/config';
import { EventEmitter } from 'events';
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler';
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator';

export class MediationRecipientModule {
  private agentConfig: AgentConfig;
  private mediationRecipientService: MediationRecipientService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;
  private eventEmitter: EventEmitter;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig;
    this.messagePickupService = messagePickupService;
    this.connectionService = connectionService;
    this.mediationRecipientService = mediationRecipientService;
    this.messageSender = messageSender;
    this.eventEmitter = eventEmitter;
    this.registerHandlers(dispatcher);
  }

  public async downloadMessages() {
    const inboundConnection = this.getInboundConnection()
    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  public getInboundConnection() {
    return this.agentConfig.inboundConnection
  }

  public async listMediators() {
    return await this.mediationRecipientService.getMediators();
  }
  
  public async getDefaultMediatorId() {
    return this.mediationRecipientService.getDefaultMediatorId()
  }

  public async getDefaultMediator(){
    const mediatorId: string | undefined = this.mediationRecipientService.getDefaultMediatorId()
    if(mediatorId === undefined ){
      return this.mediationRecipientService.fetchMediatorById(mediatorId)
    }

  }
  public async requestMediation(connectionReord: ConnectionRecord) {
    const mediationRequest = await this.mediationRecipientService.prepareRequest(connectionReord.id)
    await this.messageSender.sendMessage(mediationRequest)
  }

  
  public async keylistUpdate(){

  }

  public async keylistquery(){

  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.mediationRecipientService));
    dispatcher.registerHandler(new MediationGrantedHandler(this.mediationRecipientService));
    dispatcher.registerHandler(new MediationDeniedHandler(this.mediationRecipientService));
  }
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
