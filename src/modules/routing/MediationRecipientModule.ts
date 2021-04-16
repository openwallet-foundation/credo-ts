import { AgentConfig } from '../../agent/AgentConfig';
import { ProviderRoutingService, MessagePickupService, MediationRecipientService } from './services';
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

  public async requestMediation(connectionReord: ConnectionRecord) {
    // const mediatorRecord = await this.mediationRecipientService.createMediationRequest(connectionReord);
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
