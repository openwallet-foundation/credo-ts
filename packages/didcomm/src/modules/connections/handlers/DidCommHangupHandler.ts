import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommDidRotateService } from '../services'

import { DidCommHangupMessage } from '../messages'

export class DidCommHangupHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  public supportedMessages = [DidCommHangupMessage]

  public constructor(didRotateService: DidCommDidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommHangupHandler>) {
    await this.didRotateService.processHangup(inboundMessage)

    return undefined
  }
}
