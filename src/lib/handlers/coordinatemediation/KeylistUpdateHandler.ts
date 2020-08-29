import { Handler, HandlerInboundMessage } from '../Handler';
import { ProviderRoutingService } from '../../protocols/routing/ProviderRoutingService';
import { KeylistUpdateMessage } from '../../protocols/coordinatemediation/KeylistUpdateMessage';

export class KeylistUpdateHandler implements Handler {
  private routingService: ProviderRoutingService;
  public supportedMessages = [KeylistUpdateMessage];

  public constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    this.routingService.updateRoutes(messageContext, messageContext.connection);
  }
}
