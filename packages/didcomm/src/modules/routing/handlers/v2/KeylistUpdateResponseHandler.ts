import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { KeylistUpdateResponseMessage } from '../../messages/v2'
import type { DidCommMediationRecipientService } from '../../services/DidCommMediationRecipientService'

export class KeylistUpdateResponseHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistUpdateResponseHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistUpdateResultsV2(messageContext)

    return undefined
  }
}
