import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { MediationConsumerService } from '../services/MediationConsumerService';
import { MediationGrantedMessage } from '../messages';

// Handle mediation granted. Should this be called by the service or the module?
// I'll have to look at other modules to see how they're connected to their handlers. 

export class MediationGrantedHandler implements Handler {
  private mediationConsumerService: MediationConsumerService;
  private agentConfig: AgentConfig;
  public supportedMessages = [MediationGrantedMessage];

  public constructor(connectionService: MediationConsumerService, agentConfig: AgentConfig) {
    this.mediationConsumerService = mediationConsumerService;
    this.agentConfig = agentConfig;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantedHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    //  Do validation here. Does the message match. 


    await this.mediationService.processResponse(messageContext);

    if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createTrustPing(messageContext.connection.id);
      return createOutboundMessage(messageContext.connection, message);
    }
  }
}