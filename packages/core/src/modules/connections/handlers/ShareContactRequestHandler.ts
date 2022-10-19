import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ShareContactService } from '../services'

import { ShareContactRequestMessage } from '../messages'

export class ShareContactRequestHandler implements Handler {
  private shareContactService: ShareContactService
  public supportedMessages = [ShareContactRequestMessage]

  public constructor(shareContactService: ShareContactService) {
    this.shareContactService = shareContactService
  }

  public async handle(messageContext: HandlerInboundMessage<ShareContactRequestHandler>) {
    return this.shareContactService.receiveShareContactRequest(messageContext)
  }
}
