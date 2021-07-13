import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { RecipientService } from '../services/RecipientService'

import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements Handler {
  private recipientService: RecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(recipientService: RecipientService) {
    this.recipientService = recipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    await this.recipientService.processMediationGrant(messageContext)
  }
}
