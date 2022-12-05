import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { V2MediationRecipientService } from '../V2MediationRecipientService'

import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements Handler {
  private mediationRecipientService: V2MediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: V2MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    await this.mediationRecipientService.processMediationGrant(messageContext)
  }
}
