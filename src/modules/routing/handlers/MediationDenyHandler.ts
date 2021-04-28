import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationDenyMessage } from '../messages'
import { MediationRecipientService } from '..'

export class MediationDenyHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationDenyMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDenyHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    await this.mediationRecipientService.processMediationDeny(messageContext)
  }
}
