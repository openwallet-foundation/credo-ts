import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediationRecipientService } from '../services'

import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements DidCommMessageHandler {
  public mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistUpdateResponseHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistUpdateResults(messageContext)

    return undefined
  }
}
