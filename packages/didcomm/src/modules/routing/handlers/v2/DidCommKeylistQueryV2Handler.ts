import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../models'
import { DidCommKeylistQueryV2Message } from '../../messages/v2'
import type { DidCommMediatorService } from '../../services/DidCommMediatorService'

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
