import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediationRecipientService } from '../services/DidCommMediationRecipientService'

import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationGrantHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrant(messageContext)

    return undefined
  }
}
