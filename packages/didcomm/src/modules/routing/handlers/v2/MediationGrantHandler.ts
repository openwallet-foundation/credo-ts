import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { MediateGrantMessage } from '../../messages/v2'
import type { DidCommMediationRecipientService } from '../../services/DidCommMediationRecipientService'

export class MediationGrantHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [MediateGrantMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationGrantHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrantV2(messageContext)

    return undefined
  }
}
