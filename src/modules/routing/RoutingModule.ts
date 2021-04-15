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
import { MessagePickupHandler, ForwardHandler, KeylistUpdateHandler } from './handlers';
import { Logger } from '../../logger';
import { MediationService } from './services/MediationService';
export class RoutingModule {
  private agentConfig: AgentConfig;
  private providerRoutingService: ProviderRoutingService;
  private mediationService: MediationService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;
  private logger: Logger;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    providerRoutingService: ProviderRoutingService,
    mediationService: MediationService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig;
    this.providerRoutingService = providerRoutingService;
    this.mediationService = mediationService;
    this.messagePickupService = messagePickupService;
    this.connectionService = connectionService;
    this.messageSender = messageSender;
    this.logger = agentConfig.logger;
    this.registerHandlers(dispatcher);
  }

  public async provision(mediatorConfiguration: MediatorConfiguration) {
    // let mediationRecord = await this.mediationService.find(mediatorConfiguration.);
    let mediationRecord = null;

    if (!mediationRecord) {
      this.logger.info('No provision record found. Creating connection with mediator.');
      const { verkey, invitationUrl, alias = 'Mediator' } = mediatorConfiguration;
      const mediatorInvitation = await ConnectionInvitationMessage.fromUrl(invitationUrl);

      const connection = await this.connectionService.processInvitation(mediatorInvitation, { alias });
      const {
        message: connectionRequest,
        connectionRecord: connectionRecord,
      } = await this.connectionService.createRequest(connection.id);
      const connectionResponse = await this.messageSender.sendAndReceiveMessage(
        createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation),
        ConnectionResponseMessage
      );
      await this.connectionService.processResponse(connectionResponse);
      const { message: trustPing } = await this.connectionService.createTrustPing(connectionRecord.id);
      await this.messageSender.sendMessage(createOutboundMessage(connectionRecord, trustPing));

      const provisioningProps = {
        connectionId: connectionRecord.id,
        recipientKey: verkey,
      };
      mediationRecord = await this.mediationService.create(provisioningProps);
      this.logger.debug('Provisioning record has been saved.');
    }

    this.logger.debug('Provisioning record:', mediationRecord);

    const agentConnectionAtMediator = await this.connectionService.find(mediationRecord.mediatorConnectionId);

    if (!agentConnectionAtMediator) {
      throw new Error('Connection not found!');
    }
    this.logger.debug('agentConnectionAtMediator', agentConnectionAtMediator);

    agentConnectionAtMediator.assertState(ConnectionState.Complete);

    this.agentConfig.establishInbound({
      verkey: mediationRecord.mediatorPublicVerkey,
      connection: agentConnectionAtMediator,
    });

    return agentConnectionAtMediator;
  }

  public async downloadMessages() {
    const inboundConnection = this.getInboundConnection();
    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection);
      const batchResponse = await this.messageSender.sendAndReceiveMessage(outboundMessage, BatchMessage);

      // TODO: do something about the different types of message variable all having a different purpose
      return batchResponse.message.messages.map(msg => msg.message);
    }
    return [];
  }

  public getInboundConnection() {
    return this.agentConfig.inboundConnection;
  }

  public getRoutingTable() {
    return this.providerRoutingService.getRoutes();
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateHandler(this.providerRoutingService));
    dispatcher.registerHandler(new ForwardHandler(this.providerRoutingService));
    dispatcher.registerHandler(new MessagePickupHandler(this.messagePickupService));
  }
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
