import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommBasicMessage } from '../messages'
import type { DidCommBasicMessageService } from '../services/DidCommBasicMessageService'

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
