import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommBasicMessageService } from '../services/DidCommBasicMessageService'

import { DidCommBasicMessage } from '../messages'

export class DidCommBasicMessageHandler implements DidCommMessageHandler {
  private basicMessageService: DidCommBasicMessageService
  public supportedMessages = [DidCommBasicMessage]

  public constructor(basicMessageService: DidCommBasicMessageService) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommBasicMessageHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageService.save(messageContext, connection)

    return undefined
  }
}
