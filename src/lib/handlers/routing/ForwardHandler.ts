import { Handler, HandlerInboundMessage } from '../Handler';
import { ProviderRoutingService } from '../../protocols/routing/ProviderRoutingService';
import { ForwardMessage } from '../../protocols/routing/ForwardMessage';

export class ForwardHandler implements Handler {
  private routingService: ProviderRoutingService;
  public supportedMessages = [ForwardMessage];

  public constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    return this.routingService.forward(messageContext);
  }
}
