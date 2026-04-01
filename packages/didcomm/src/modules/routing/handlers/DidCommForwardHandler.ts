import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommForwardMessage, DidCommForwardMessageV2 } from '../messages'
import type { DidCommMediatorService } from '../services'

export class DidCommForwardHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [DidCommForwardMessage, DidCommForwardMessageV2]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommForwardHandler>) {
    await this.mediatorService.processForwardMessage(messageContext)
    return undefined
  }
}
