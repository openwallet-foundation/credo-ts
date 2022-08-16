import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MediationRecipientService } from '../services'

import { MediationDenyMessageV2 } from '../messages'

export class MediationDenyHandler implements Handler<typeof DIDCommV2Message> {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationDenyMessageV2]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDenyHandler>) {
    await this.mediationRecipientService.processMediationDeny(messageContext)
  }
}
