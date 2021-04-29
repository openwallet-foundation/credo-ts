import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationService } from '../services'
import { ForwardMessage } from '../messages'

export class ForwardHandler implements Handler {
  private routingService: MediationService
  public supportedMessages = [ForwardMessage]

  public constructor(routingService: MediationService) {
    this.routingService = routingService
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    await this.routingService.processForwardMessage(messageContext)
  }
}
