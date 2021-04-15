import { AgentConfig } from '../../agent/AgentConfig';
import { ProviderRoutingService, MessagePickupService, ProvisioningService } from './services';
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
import { MediationConsumerService } from './services/MediationConsumerService';
import agentConfig from '../../../samples/config';

export class MediationConsumerModule {
  private agentConfig: AgentConfig;
  private providerRoutingService: ProviderRoutingService;
  private provisioningService: ProvisioningService;
  private mediationConsumerService: MediationConsumerService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;
  private logger: Logger;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    providerRoutingService: ProviderRoutingService,
    mediationConsumerService: MediationConsumerService,
    provisioningService: ProvisioningService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig;
    this.providerRoutingService = providerRoutingService;
    this.provisioningService = provisioningService;
    this.messagePickupService = messagePickupService;
    this.connectionService = connectionService;
    this.mediationConsumerService = mediationConsumerService;
    this.messageSender = messageSender;
    this.logger = agentConfig.logger;
    this.registerHandlers(dispatcher);
  }

  public async requestMediation(connectionReord: ConnectionRecord) {
    const mediatorRecord = await this.mediationConsumerService.createMediationRequest(connectionReord);
  }
  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.providerRoutingService));
    dispatcher.registerHandler(new MessagePickupHandler(this.messagePickupService));
    dispatcher.registerHandler(new MediationGrantedHandler(this.mediationConsumerService));
    dispatcher.registerHandler(new MediationDeniedHandler(this.mediationConsumerService));
  }
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
