import { AgentConfig } from '../agent/AgentConfig';
import { ProvisioningService } from '../agent/ProvisioningService';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { decodeInvitationFromUrl } from '../helpers';
import logger from '../logger';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';
import { ConnectionResponseMessage } from '../protocols/connections/ConnectionResponseMessage';
import { BatchMessage } from '../protocols/messagepickup/BatchMessage';

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

  public async provision(agencyConfiguration: AgencyConfiguration) {
    let provisioningRecord = await this.provisioningService.find();

    if (!provisioningRecord) {
      logger.log('There is no provisioning. Creating connection with agency...');
      const { verkey, invitationUrl } = agencyConfiguration;
      const agencyInvitation = await decodeInvitationFromUrl(invitationUrl);

      const connectionRequest = await this.connectionService.acceptInvitation(agencyInvitation);
      const connectionResponse = await this.messageSender.sendAndReceiveMessage(
        connectionRequest,
        ConnectionResponseMessage
      );
      const ack = await this.connectionService.acceptResponse(connectionResponse);
      await this.messageSender.sendMessage(ack);

      const provisioningProps = {
        agencyConnectionId: connectionRequest.connection.id,
        agencyPublicVerkey: verkey,
      };
      provisioningRecord = await this.provisioningService.create(provisioningProps);
      logger.log('Provisioning record has been saved.');
    }

    logger.log('Provisioning record:', provisioningRecord);

    const agentConnectionAtAgency = await this.connectionService.find(provisioningRecord.agencyConnectionId);

    if (!agentConnectionAtAgency) {
      throw new Error('Connection not found!');
    }
    logger.log('agentConnectionAtAgency', agentConnectionAtAgency);

    if (agentConnectionAtAgency.state !== ConnectionState.COMPLETE) {
      throw new Error('Connection has not been established.');
    }

    this.agentConfig.establishInbound({
      verkey: provisioningRecord.agencyPublicVerkey,
      connection: agentConnectionAtAgency,
    });

    return agentConnectionAtAgency;
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

interface AgencyConfiguration {
  verkey: Verkey;
  invitationUrl: string;
}
