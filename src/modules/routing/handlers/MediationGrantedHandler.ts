import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { MediationRecipientService } from '../services/MediationRecipientService';
import { RequestMediationMessage } from '../messages';

// Handle mediation granted. Should this be called by the service or the module?
// I'll have to look at other modules to see how they're connected to their handlers.

export class MediationGrantedHandler implements Handler {
  private mediationService: MediationRecipientService;
  public supportedMessages = [RequestMediationMessage];

  public constructor(mediationService: MediationRecipientService) {
    this.mediationService = mediationService;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantedHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    // await this.mediationService.processResponse(messageContext);

    // if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
    //   const { message } = await this.connectionService.createTrustPing(messageContext.connection.id);
    //   return createOutboundMessage(messageContext.connection, message);
    // }
  }
}
