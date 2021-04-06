import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { MediationConsumerService } from '../services/MediationConsumerService';
import { MediationDeniedMessage } from '../messages/MediationDeniedMessage';

export class MediationDeniedHandler implements Handler {
  private mediationConsumerService: MediationConsumerService;
  private agentConfig: AgentConfig;
  public supportedMessages = [MediationDeniedMessage];

  public constructor(mediationService: MediationConsumerService, agentConfig: AgentConfig) {
    this.mediationConsumerService = mediationService;
    this.agentConfig = agentConfig;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDeniedHandler>) {
    //   Need to figure this method out...
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    await this.mediationConsumerService.processResponse(messageContext); //Process deny/grant in other handler, too. Move this to mediation service. 

  }
}