import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommBasicMessageService } from '../services/DidCommBasicMessageService'

import { BasicMessage } from '../messages'

export class BasicMessageHandler implements DidCommMessageHandler {
  private basicMessageService: DidCommBasicMessageService
  public supportedMessages = [BasicMessage]

  public constructor(basicMessageService: DidCommBasicMessageService) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<BasicMessageHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageService.save(messageContext, connection)

    return undefined
  }
}
