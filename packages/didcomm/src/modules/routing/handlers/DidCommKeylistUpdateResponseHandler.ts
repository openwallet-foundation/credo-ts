import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommMediationRecipientService } from '../services'

import { DidCommKeylistUpdateResponseMessage } from '../messages'

export class DidCommKeylistUpdateResponseHandler implements DidCommMessageHandler {
  public mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommKeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommKeylistUpdateResponseHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processKeylistUpdateResults(messageContext)

    return undefined
  }
}
