import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { MediationRecipientService } from '../services'

import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements DidCommMessageHandler {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<KeylistUpdateResponseHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistUpdateResults(messageContext)

    return undefined
  }
}
