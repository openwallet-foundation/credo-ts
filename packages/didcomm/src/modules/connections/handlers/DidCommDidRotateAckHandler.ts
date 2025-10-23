import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommDidRotateAckMessage } from '../messages'
import type { DidCommDidRotateService } from '../services'

export class DidCommDidRotateAckHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  public supportedMessages = [DidCommDidRotateAckMessage]

  public constructor(didRotateService: DidCommDidRotateService) {
    this.didRotateService = didRotateService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommDidRotateAckHandler>) {
    await this.didRotateService.processRotateAck(inboundMessage)

    return undefined
  }
}
