import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../models'
import { KeylistQueryMessage } from '../../messages/v2'
import type { DidCommMediatorService } from '../../services/DidCommMediatorService'

export class KeylistQueryHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [KeylistQueryMessage]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistQueryHandler>) {
    const connection = messageContext.assertReadyConnection()

    const response = await this.mediatorService.processKeylistQueryV2(messageContext)
    return new DidCommOutboundMessageContext(response, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
