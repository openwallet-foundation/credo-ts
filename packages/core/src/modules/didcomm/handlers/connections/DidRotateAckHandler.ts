import type { DidRotateService } from '../../services'
import type { MessageHandler, MessageHandlerInboundMessage } from '../MessageHandler'

import { DidRotateAckMessage } from '../../messages'

export class DidRotateAckHandler implements MessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [DidRotateAckMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<DidRotateAckHandler>) {
    await this.didRotateService.processRotateAck(inboundMessage)
  }
}
