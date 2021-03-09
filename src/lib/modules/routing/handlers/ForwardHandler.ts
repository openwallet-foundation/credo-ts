import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { ProviderRoutingService } from '../services';
import { ForwardMessage } from '../messages';

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
