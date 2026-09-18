import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMediationRecipientService } from '../../../services/DidCommMediationRecipientService'
import { DidCommKeylistV2Message } from '../messages'

export class DidCommKeylistV2Handler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommKeylistV2Message]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommKeylistV2Handler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistV2(messageContext)

    return undefined
  }
}
