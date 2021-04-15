import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { AgentConfig } from '../../../agent/AgentConfig';
import { createOutboundMessage } from '../../../agent/helpers';
import { RequestMediationMessage } from '../messages';
import { MediationRecipientService } from '../services/MediationRecipientService'

// Handles the mediation denied state.
// I need to look up the RFC and make sure I'm handling this correctly.

export class MediationDeniedHandler implements Handler {
  private mediationRecipientService: MediationRecipientService;
  public supportedMessages = [RequestMediationMessage];

  public constructor(mediationService: MediationRecipientService) {
    this.mediationRecipientService = mediationService;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDeniedHandler>) {
    //   Need to figure this method out...
    // if (!messageContext.connection) {
    //   throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    // }

    // await this.mediationRecipientService.processResponse(messageContext);

    // if (messageContext.connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
    //   const { message } = await this.connectionService.createTrustPing(messageContext.connection.id);
    //   return createOutboundMessage(messageContext.connection, message);
    // }
  }
}
