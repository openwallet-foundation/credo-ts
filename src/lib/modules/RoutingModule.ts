import { AgentConfig } from '../agent/AgentConfig';
import { ProvisioningService } from '../agent/ProvisioningService';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import logger from '../logger';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { ConnectionResponseMessage } from '../protocols/connections/ConnectionResponseMessage';
import { BatchMessage } from '../protocols/messagepickup/BatchMessage';
import { createOutboundMessage } from '../protocols/helpers';
import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';

export class RoutingModule {
  private agentConfig: AgentConfig;
  private providerRoutingService: ProviderRoutingService;
  private provisioningService: ProvisioningService;
  private messagePickupService: MessagePickupService;
  private connectionService: ConnectionService;
  private messageSender: MessageSender;

  public constructor(
    agentConfig: AgentConfig,
    providerRoutingService: ProviderRoutingService,
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
    this.messageSender = messageSender;
  }

  public async provision(mediatorConfiguration: MediatorConfiguration) {
    let provisioningRecord = await this.provisioningService.find();

    if (!provisioningRecord) {
      logger.log('There is no provisioning. Creating connection with mediator...');
      const { verkey, invitationUrl, alias = 'Mediator' } = mediatorConfiguration;
      const mediatorInvitation = await ConnectionInvitationMessage.fromUrl(invitationUrl);

      const connection = await this.connectionService.processInvitation(mediatorInvitation, { alias });
      const { message: connectionRequest, record: connectionRecord } = await this.connectionService.createRequest(
        connection.id
      );
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
      logger.log('Provisioning record has been saved.');
    }

    logger.log('Provisioning record:', provisioningRecord);

    const agentConnectionAtMediator = await this.connectionService.find(provisioningRecord.mediatorConnectionId);

    if (!agentConnectionAtMediator) {
      throw new Error('Connection not found!');
    }
    logger.log('agentConnectionAtMediator', agentConnectionAtMediator);

    agentConnectionAtMediator.assertState(ConnectionState.Complete);

    this.agentConfig.establishInbound({
      verkey: provisioningRecord.mediatorPublicVerkey,
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
}

interface MediatorConfiguration {
  verkey: Verkey;
  invitationUrl: string;
  alias?: string;
}
