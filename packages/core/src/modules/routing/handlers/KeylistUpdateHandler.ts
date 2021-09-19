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
    const { message, connection } = messageContext

    if (!connection) {
      throw new AriesFrameworkError(`No connection associated with incoming message with id ${message.id}`)
    }

    const response = await this.mediatorService.processKeylistUpdateRequest(messageContext)
    return createOutboundMessage(connection, response)
  }
}
