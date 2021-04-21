import { AgentConfig } from '../../agent/AgentConfig';
import { ProviderRoutingService, MessagePickupService, ProvisioningService } from './services';
import { MessageSender } from '../../agent/MessageSender';
import { createOutboundMessage } from '../../agent/helpers';
import {
  ConnectionService,
  ConnectionState,
  ConnectionInvitationMessage,
  ConnectionResponseMessage,
  ConnectionRecord,
} from '../connections';
import { BatchMessage } from './messages';
import type { Verkey } from 'indy-sdk';
import { Dispatcher } from '../../agent/Dispatcher';
import { MessagePickupHandler, ForwardHandler, KeylistUpdateHandler } from './handlers';
import { Logger } from '../../logger';
import { MediationService } from './services/MediationService';
import { EventEmitter } from 'events';
import { MediationGrantHandler } from './handlers/MediationGrantHandler';
import { MediationRequestHandler } from './handlers/MediationRequestHandler';
import { MediationRecord } from './repository/MediationRecord';
import { MediationDenyHandler } from './handlers/MediationDenyHandler';

export class RoutingModule {
  private agentConfig: AgentConfig;
  private mediationService: MediationService;
  private providerRoutingService: ProviderRoutingService;
  private provisioningService: ProvisioningService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;
  private logger: Logger;

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    mediationService: MediationService,
    providerRoutingService: ProviderRoutingService,
    provisioningService: ProvisioningService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig;
    this.mediationService = mediationService;
    this.providerRoutingService = providerRoutingService;
    this.provisioningService = provisioningService;
    this.messagePickupService = messagePickupService;
    this.connectionService = connectionService;
    this.messageSender = messageSender;
    this.logger = agentConfig.logger;
    this.registerHandlers(dispatcher);
  }

  /**
   * Get the event emitter for the mediation service. Will emit events
   * when related messages are received.
   *
   * @returns event emitter for mediation-related received messages
   */
  public get mediationEvents(): EventEmitter {
    return this.mediationService;
  }

  public async requestMediation(connection: ConnectionRecord) {
    const outboundMessage = await this.mediationService.requestMediation(connection);
    const response = await this.messageSender.sendMessage(outboundMessage);
    return response;
  }

  public async grantMediation(connection: ConnectionRecord, mediation: MediationRecord) {
    const outboundMessage = await this.mediationService.grantMediation(connection, mediation);
    const response = await this.messageSender.sendMessage(outboundMessage);
    return response;
  }

  public async provision(mediatorConfiguration: MediatorConfiguration) {
    let provisioningRecord = await this.provisioningService.find();

    if (!provisioningRecord) {
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
        mediatorConnectionId: connectionRecord.id,
        mediatorPublicVerkey: verkey,
      };
      provisioningRecord = await this.provisioningService.create(provisioningProps);
      this.logger.debug('Provisioning record has been saved.');
    }

    this.logger.debug('Provisioning record:', provisioningRecord);

    const agentConnectionAtMediator = await this.connectionService.find(provisioningRecord.mediatorConnectionId);

    if (!agentConnectionAtMediator) {
      throw new Error('Connection not found!');
    }
    this.logger.debug('agentConnectionAtMediator', agentConnectionAtMediator);

    agentConnectionAtMediator.assertState(ConnectionState.Complete);

    this.agentConfig.establishInbound({
      verkey: provisioningRecord.mediatorPublicVerkey,
      connection: agentConnectionAtMediator,
    });

    return agentConnectionAtMediator;
  }

  public async downloadMessages(mediatorConnection?: ConnectionRecord) {
    const inboundConnection = mediatorConnection
      ? { verkey: mediatorConnection.theirKey!, connection: mediatorConnection }
      : this.getInboundConnection();

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
    dispatcher.registerHandler(new MediationGrantHandler(this.mediationService));
    dispatcher.registerHandler(new MediationDenyHandler(this.mediationService));
    dispatcher.registerHandler(new MediationRequestHandler(this.mediationService));
  }
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
