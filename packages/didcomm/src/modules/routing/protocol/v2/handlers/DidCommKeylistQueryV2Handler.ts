import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommMediatorService } from '../../../services/DidCommMediatorService'
import { DidCommKeylistQueryV2Message } from '../messages'

export class DidCommKeylistQueryV2Handler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [DidCommKeylistQueryV2Message]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommKeylistQueryV2Handler>) {
    const connection = messageContext.assertReadyConnection()

    const response = await this.mediatorService.processKeylistQueryV2(messageContext)
    return new DidCommOutboundMessageContext(response, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
