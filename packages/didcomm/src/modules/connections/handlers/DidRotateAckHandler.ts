import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidRotateService } from '../services'

import { DidRotateAckMessage } from '../messages'

export class DidRotateAckHandler implements DidCommMessageHandler {
  private didRotateService: DidRotateService
  public supportedMessages = [DidRotateAckMessage]

  public constructor(didRotateService: DidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidRotateAckHandler>) {
    await this.didRotateService.processRotateAck(inboundMessage)

    return undefined
  }
}
