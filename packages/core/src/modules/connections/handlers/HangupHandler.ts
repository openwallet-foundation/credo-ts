import type { MessageHandler, MessageHandlerInboundMessage } from '../../../agent/MessageHandler'
import type { DidRotateService } from '../services'

import { RotateAckMessage } from '../messages'

export class HangupHandler implements MessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [RotateAckMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<HangupHandler>) {
    await this.didRotateService.processHangup(inboundMessage)
  }
}
