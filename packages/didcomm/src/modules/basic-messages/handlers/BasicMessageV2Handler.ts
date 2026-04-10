import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommBasicMessageV2 } from '../messages'
import type { DidCommBasicMessageService } from '../services/DidCommBasicMessageService'

export class DidCommBasicMessageV2Handler implements DidCommMessageHandler {
  private basicMessageService: DidCommBasicMessageService
  public supportedMessages = [DidCommBasicMessageV2]

  public constructor(basicMessageService: DidCommBasicMessageService) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommBasicMessageV2Handler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageService.saveV2(messageContext, connection)

    return undefined
  }
}
