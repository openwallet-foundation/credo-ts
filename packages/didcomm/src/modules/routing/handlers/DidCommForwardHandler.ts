import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediatorService } from '../services'

import { DidCommForwardMessage } from '../messages'

export class DidCommForwardHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [DidCommForwardMessage]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommForwardHandler>) {
    await this.mediatorService.processForwardMessage(messageContext)

    return undefined
  }
}
