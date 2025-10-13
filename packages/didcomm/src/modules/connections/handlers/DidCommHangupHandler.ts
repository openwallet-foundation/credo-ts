import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommHangupMessage } from '../messages'
import type { DidCommDidRotateService } from '../services'

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
