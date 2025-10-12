import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommOutboundMessageContext } from '../../../models'
import { DidCommKeylistUpdateMessage } from '../messages'
import type { DidCommMediatorService } from '../services/DidCommMediatorService'

export class DidCommKeylistUpdateHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [DidCommKeylistUpdateMessage]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommKeylistUpdateHandler>) {
    const connection = messageContext.assertReadyConnection()

    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    return new DidCommOutboundMessageContext(response, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
