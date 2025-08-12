import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidRotateService } from '../services'

import { HangupMessage } from '../messages'

export class HangupHandler implements DidCommMessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [HangupMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<HangupHandler>) {
    await this.didRotateService.processHangup(inboundMessage)

    return undefined
  }
}
