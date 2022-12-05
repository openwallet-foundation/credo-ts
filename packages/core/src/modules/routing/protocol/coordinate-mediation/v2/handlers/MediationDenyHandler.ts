import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { V2MediationRecipientService } from '../V2MediationRecipientService'

import { MediationDenyMessage } from '../messages'

export class MediationDenyHandler implements Handler {
  private mediationRecipientService: V2MediationRecipientService
  public supportedMessages = [MediationDenyMessage]

  public constructor(mediationRecipientService: V2MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDenyHandler>) {
    await this.mediationRecipientService.processMediationDeny(messageContext)
  }
}
