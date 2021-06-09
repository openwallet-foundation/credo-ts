import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ForwardMessage } from '../messages'
import { ProviderRoutingService } from '../services'

export class ForwardHandler implements Handler {
  private routingService: ProviderRoutingService
  public supportedMessages = [ForwardMessage]

  public constructor(routingService: ProviderRoutingService) {
    this.routingService = routingService
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    return this.routingService.forward(messageContext)
  }
}
