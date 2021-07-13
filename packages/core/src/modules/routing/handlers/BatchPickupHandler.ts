import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessagePickupService } from '../services'

import { AriesFrameworkError } from '../../../error'
import { BatchPickupMessage } from '../messages'

export class BatchPickupHandler implements Handler {
  private messagePickupService: MessagePickupService
  public supportedMessages = [BatchPickupMessage]

  public constructor(messagePickupService: MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: HandlerInboundMessage<BatchPickupHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    return this.messagePickupService.batch(messageContext)
  }
}
