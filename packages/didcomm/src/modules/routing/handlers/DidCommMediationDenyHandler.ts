import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediationRecipientService } from '../services'

import { DidCommMediationDenyMessage } from '../messages'

export class DidCommMediationDenyHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommMediationDenyMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationDenyHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationDeny(messageContext)

    return undefined
  }
}
