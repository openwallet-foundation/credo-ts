import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediatorService } from '../services/MediatorService'

import { OutboundDidCommMessageContext } from '../../../models'
import { KeylistUpdateMessage } from '../messages'

export class KeylistUpdateHandler implements DidCommMessageHandler {
  private mediatorService: MediatorService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediatorService: MediatorService) {
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
