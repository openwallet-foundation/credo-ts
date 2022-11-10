import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediatorService } from '../services/MediatorService'

import { createOutboundDIDCommV1Message } from '../../../agent/helpers'
import { KeylistUpdateMessage } from '../messages'

export class KeylistUpdateHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    const connection = messageContext.assertReadyConnection()

    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    return createOutboundDIDCommV1Message(connection, response)
  }
}
