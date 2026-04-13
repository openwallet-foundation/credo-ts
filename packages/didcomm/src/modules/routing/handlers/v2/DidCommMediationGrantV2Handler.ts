import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { DidCommMediateGrantV2Message } from '../../messages/v2'
import type { DidCommMediationRecipientService } from '../../services/DidCommMediationRecipientService'

export class DidCommMediationGrantV2Handler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommMediateGrantV2Message]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationGrantV2Handler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationGrantV2(messageContext)

    return undefined
  }
}
