import { Handler, HandlerInboundMessage } from '../../../agent/Handler';
import { ProviderRoutingService } from '../services';
import { KeylistUpdateMessage } from '../messages';
import { createOutboundMessage } from '../../../agent/helpers';

// TODO - Update
export class KeylistUpdatedHandler implements Handler {
  private routingService: ProviderRoutingService;
  public supportedMessages = [KeylistUpdateMessage];

  public constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdatedHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    const message = this.routingService.updateRoutes(messageContext);
    return createOutboundMessage(messageContext.connection, message);
  }
}
