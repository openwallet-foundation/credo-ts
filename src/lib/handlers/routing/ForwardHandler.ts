import { Handler, HandlerInboundMessage } from '../Handler';
import { ProviderRoutingService } from '../../protocols/routing/ProviderRoutingService';
import { ForwardMessage } from '../../protocols/routing/ForwardMessage';

export class ForwardHandler implements Handler {
  routingService: ProviderRoutingService;
  supportedMessages = [ForwardMessage];

  constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService;
  }

  async handle(inboundMessage: HandlerInboundMessage<ForwardHandler>) {
    const outboundMessage = this.routingService.forward(inboundMessage);
    return outboundMessage;
  }
}
