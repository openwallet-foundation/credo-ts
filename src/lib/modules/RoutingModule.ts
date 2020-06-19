import { AgentConfig } from '../agent/AgentConfig';
import { ProvisioninService } from '../agent/ProvisioningService';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessagePickupService } from '../protocols/messagepickup/MessagePickupService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';
import { decodeInvitationFromUrl } from '../helpers';
import logger from '../logger';
import { ProviderRoutingService } from '../protocols/routing/ProviderRoutingService';

export class RoutingModule {
  agentConfig: AgentConfig;
  providerRoutingService: ProviderRoutingService;
  provisioningService: ProvisioninService;
  messagePickupService: MessagePickupService;
  connectionService: ConnectionService;
  messageSender: MessageSender;

  constructor(
    agentConfig: AgentConfig,
    providerRoutingService: ProviderRoutingService,
    provisioningService: ProvisioninService,
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

  async provision(agencyConfiguration: AgencyConfiguration) {
    let provisioningRecord = await this.provisioningService.find();

    if (!provisioningRecord) {
      logger.log('There is no provisioning. Creating connection with agency...');
      const { verkey, invitationUrl } = agencyConfiguration;
      const agencyInvitation = decodeInvitationFromUrl(invitationUrl);

      const connectionRequest = await this.connectionService.acceptInvitation(agencyInvitation);
      const connectionResponse = await this.messageSender.sendAndReceiveMessage(connectionRequest);
      const ack = await this.connectionService.acceptResponse(connectionResponse);
      await this.messageSender.sendMessage(ack);

      const provisioningProps = {
        agencyConnectionVerkey: connectionRequest.connection.verkey,
        agencyPublicVerkey: verkey,
      };
      provisioningRecord = await this.provisioningService.create(provisioningProps);
      logger.log('Provisioning record has been saved.');
    }

    logger.log('Provisioning record:', provisioningRecord);

    const agentConnectionAtAgency = await this.connectionService.findByVerkey(
      provisioningRecord.agencyConnectionVerkey
    );

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

  async downloadMessages() {
    const inboundConnection = this.getInboundConnection();
    if (inboundConnection) {
      const outboundMessage = await this.messagePickupService.batchPickup(inboundConnection);
      const batchMessage = await this.messageSender.sendAndReceiveMessage(outboundMessage);
      return batchMessage.message.messages;
    }
    return [];
  }

  getInboundConnection() {
    return this.agentConfig.inboundConnection;
  }

  getRoutes() {
    return this.providerRoutingService.getRoutes();
  }
}

interface AgencyConfiguration {
  verkey: Verkey;
  invitationUrl: string;
}
