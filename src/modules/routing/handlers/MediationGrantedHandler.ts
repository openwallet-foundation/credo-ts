import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { MediationConsumerService } from '../services/MediationConsumerService';
import { MediationGrantedMessage } from '../messages';

// 

export class MediationGrantedHandler implements Handler {
  private mediationConsumerService: MediationConsumerService;
  private agentConfig: AgentConfig;
  public supportedMessages = [MediationGrantedMessage];

  public constructor(connectionService: MediationConsumerService, agentConfig: AgentConfig) {
    this.mediationConsumerService = mediationConsumerService;
    this.agentConfig = agentConfig;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantedHandler>) {
    // Should we keep this? Seems unlikely, but it is a possibilty that we get random messages
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    //  Do validation here. Does the message match. 
    // if (messageContext.connection.type !=== MeediationConsumerMessage.type)

    await this.mediationService.processResponse(messageContext);

    
  }
}