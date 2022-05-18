import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { BasicMessageService } from '../services/BasicMessageService'

import { BasicMessage } from '../messages'

export class BasicMessageHandler implements Handler {
  private basicMessageService: BasicMessageService
  public supportedMessages = [BasicMessage]

  public constructor(basicMessageService: BasicMessageService) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageService.save(messageContext, connection)
  }
}
