import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommBasicMessageV2Service } from '../DidCommBasicMessageV2Service'
import { DidCommBasicMessageV2 } from '../messages'

export class DidCommBasicMessageV2Handler implements DidCommMessageHandler {
  private basicMessageService: DidCommBasicMessageV2Service
  public supportedMessages = [DidCommBasicMessageV2]

  public constructor(basicMessageService: DidCommBasicMessageV2Service) {
    this.basicMessageService = basicMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommBasicMessageV2Handler>) {
    const connection = messageContext.assertReadyConnection()
    await this.basicMessageService.save(messageContext, connection)

    return undefined
  }
}
