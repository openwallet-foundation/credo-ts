import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationGrantMessage, RecipientService } from '..'

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
