import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediatorService } from '../services/DidCommMediatorService'

import { OutboundDidCommMessageContext } from '../../../models'
import { KeylistUpdateMessage } from '../messages'

export class KeylistUpdateHandler implements DidCommMessageHandler {
  private mediatorService: DidCommMediatorService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediatorService: DidCommMediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistUpdateHandler>) {
    const connection = messageContext.assertReadyConnection()

    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    return new OutboundDidCommMessageContext(response, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }
}
