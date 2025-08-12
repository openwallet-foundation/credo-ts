import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediationRecipientService } from '../services/MediationRecipientService'

import { MediationGrantMessage } from '../messages'

export class MediationGrantHandler implements DidCommMessageHandler {
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationGrantHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrant(messageContext)

    return undefined
  }
}
