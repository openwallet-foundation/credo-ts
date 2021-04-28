import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationGrantMessage, MediationRecipientService } from '..'

export class MediationGrantHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    await this.mediationRecipientService.processMediationGrant(messageContext)
  }
}
