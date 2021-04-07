import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { MediationDenyMessage } from '../messages';
import { MediationService } from '../services/MediationService';

export class MediationGrantHandler implements Handler {
  private routingService: MediationService;
  public supportedMessages = [MediationDenyMessage];

  public constructor(routingService: MediationService) {
    this.routingService = routingService;
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }
    this.routingService.processMediationDeny(messageContext);
  }
}
