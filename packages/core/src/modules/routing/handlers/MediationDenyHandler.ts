import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services'

import { AriesFrameworkError } from '../../../error'
import { MediationDenyMessage } from '../messages'

export class MediationDenyHandler implements Handler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationDenyMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationDenyHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection not found (verkey=${messageContext.recipientVerkey ?? 'unknown'}`)
    }
    await this.mediationRecipientService.processMediationDeny(messageContext)
  }
}
