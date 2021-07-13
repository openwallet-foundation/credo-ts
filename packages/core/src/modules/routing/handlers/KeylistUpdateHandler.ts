import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediatorService } from '../services/MediatorService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { KeylistUpdateMessage } from '../messages'

export class KeylistUpdateHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    return createOutboundMessage(messageContext.connection, response)
  }
}
