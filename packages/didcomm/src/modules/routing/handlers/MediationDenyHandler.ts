import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediationRecipientService } from '../services'

import { MediationDenyMessage } from '../messages'

export class MediationDenyHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [MediationDenyMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationDenyHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationDeny(messageContext)

    return undefined
  }
}
