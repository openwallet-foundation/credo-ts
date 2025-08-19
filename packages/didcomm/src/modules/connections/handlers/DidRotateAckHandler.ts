import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommDidRotateService } from '../services'

import { DidRotateAckMessage } from '../messages'

export class DidRotateAckHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  public supportedMessages = [DidRotateAckMessage]

  public constructor(didRotateService: DidCommDidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidRotateAckHandler>) {
    await this.didRotateService.processRotateAck(inboundMessage)

    return undefined
  }
}
