import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { MediationRequestMessage } from '../messages';
import { MediationService } from '../services/MediationService';

export class MediationRequestHandler implements Handler {
  private routingService: MediationService;
  public supportedMessages = [MediationRequestMessage];

  public constructor(routingService: MediationService) {
    this.routingService = routingService;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    return this.routingService.processMediationRequest(messageContext);
  }
}
