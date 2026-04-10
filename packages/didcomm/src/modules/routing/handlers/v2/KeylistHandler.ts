import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { KeylistMessage } from '../../messages/v2'
import type { DidCommMediationRecipientService } from '../../services/DidCommMediationRecipientService'

export class KeylistHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [KeylistMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistV2(messageContext)

    return undefined
  }
}
