import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommMediationGrantMessage } from '../messages'
import type { DidCommMediationRecipientService } from '../services/DidCommMediationRecipientService'

export class DidCommMediationGrantHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommMediationGrantMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationGrantHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrant(messageContext)

    return undefined
  }
}
