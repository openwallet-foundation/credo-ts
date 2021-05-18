import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediatorService } from '../services'
import { ForwardMessage } from '../messages'

export class ForwardHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [ForwardMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    await this.mediatorService.processForwardMessage(messageContext)
  }
}
