import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services/MediationRecipientService'

import { AriesFrameworkError } from '../../../error'
import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection not found (verkey=${messageContext.recipientVerkey ?? 'unknown'}`)
    }
    await this.mediationRecipientService.processMediationGrant(messageContext)
  }
}
