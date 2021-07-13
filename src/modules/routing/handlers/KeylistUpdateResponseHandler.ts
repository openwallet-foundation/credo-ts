import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { RecipientService } from '../services'

import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements Handler {
  public recipientService: RecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(recipientService: RecipientService) {
    this.recipientService = recipientService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    return await this.recipientService.processKeylistUpdateResults(messageContext)
  }
}
