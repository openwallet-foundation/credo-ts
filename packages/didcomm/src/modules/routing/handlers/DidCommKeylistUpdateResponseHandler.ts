import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommKeylistUpdateResponseMessage } from '../messages'
import type { DidCommMediationRecipientService } from '../services'

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
