import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ShareContactService } from '../services'

import { ShareContactResponseMessage } from '../messages'

export class ShareContactResponseHandler implements Handler {
  private shareContactService: ShareContactService
  public supportedMessages = [ShareContactResponseMessage]

  public constructor(shareContactService: ShareContactService) {
    this.shareContactService = shareContactService
  }

  public async handle(messageContext: HandlerInboundMessage<ShareContactResponseHandler>) {
    return this.shareContactService.receiveShareContactResponse(messageContext)
  }
}
