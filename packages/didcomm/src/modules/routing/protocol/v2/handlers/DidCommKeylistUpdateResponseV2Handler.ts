import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMediationRecipientService } from '../../../services/DidCommMediationRecipientService'
import { DidCommKeylistUpdateResponseV2Message } from '../messages'

export class DidCommKeylistUpdateResponseV2Handler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommKeylistUpdateResponseV2Message]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommKeylistUpdateResponseV2Handler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistUpdateResultsV2(messageContext)

    return undefined
  }
}
