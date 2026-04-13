import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommBasicMessageService } from '../../../services/DidCommBasicMessageService'
import { DidCommBasicMessageV2 } from '../messages'

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
