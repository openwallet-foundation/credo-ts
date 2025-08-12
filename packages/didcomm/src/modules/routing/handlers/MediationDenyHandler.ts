import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediationRecipientService } from '../services'

import { MediationDenyMessage } from '../messages'

export class MediationDenyHandler implements DidCommMessageHandler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationDenyMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationDenyHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationDeny(messageContext)

    return undefined
  }
}
