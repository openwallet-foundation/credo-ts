import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediatorService } from '../services'

import { ForwardMessage } from '../messages'

export class ForwardHandler implements DidCommMessageHandler {
  private mediatorService: MediatorService
  public supportedMessages = [ForwardMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ForwardHandler>) {
    await this.mediatorService.processForwardMessage(messageContext)

    return undefined
  }
}
