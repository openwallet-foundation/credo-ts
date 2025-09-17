import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediatorService } from '../services'

import { ForwardMessage } from '../messages'

export class ForwardHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [ForwardMessage]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ForwardHandler>) {
    await this.mediatorService.processForwardMessage(messageContext)

    return undefined
  }
}
