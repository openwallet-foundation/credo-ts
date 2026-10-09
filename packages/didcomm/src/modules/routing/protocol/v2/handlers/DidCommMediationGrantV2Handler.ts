import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMediationRecipientService } from '../../../services/DidCommMediationRecipientService'
import { DidCommMediateGrantV2Message } from '../messages'

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
