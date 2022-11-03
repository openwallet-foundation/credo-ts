import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services/MediationRecipientService'

import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrant(messageContext)
  }
}
