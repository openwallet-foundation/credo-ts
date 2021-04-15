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
import {
  MessagePickupHandler,
  ForwardHandler,
  KeylistUpdateHandler,
  MediationGrantedHandler,
  MediationDeniedHandler,
} from './handlers';
import { Logger } from '../../logger';
import { ConnectionRecord } from '../connections';
import agentConfig from '../../../samples/config';

export class MediationRecipientModule {
  private agentConfig: AgentConfig;
  private providerRoutingService: ProviderRoutingService;
  private mediationRecipientService: MediationRecipientService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;
  private logger: Logger;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    providerRoutingService: ProviderRoutingService,
    mediationRecipientService: MediationRecipientService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    logger: Logger
  ) {
    this.agentConfig = agentConfig;
    this.providerRoutingService = providerRoutingService;
    this.messagePickupService = messagePickupService;
    this.connectionService = connectionService;
    this.mediationRecipientService = mediationRecipientService;
    this.messageSender = messageSender;
    this.logger = agentConfig.logger;
    this.registerHandlers(dispatcher);
  }

  public async requestMediation(connectionReord: ConnectionRecord) {
    // const mediatorRecord = await this.mediationRecipientService.createMediationRequest(connectionReord);
  }
  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.providerRoutingService));
    dispatcher.registerHandler(new MessagePickupHandler(this.messagePickupService));
    dispatcher.registerHandler(new MediationGrantedHandler(this.mediationRecipientService));
    dispatcher.registerHandler(new MediationDeniedHandler(this.mediationRecipientService));
  }
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
