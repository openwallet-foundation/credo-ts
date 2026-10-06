import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommMediationRecipientService } from '../../../services/DidCommMediationRecipientService'
import { DidCommMediateDenyV2Message } from '../messages'

export class DidCommMediationDenyV2Handler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [DidCommMediateDenyV2Message]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommMediationDenyV2Handler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationDenyV2(messageContext)

    return undefined
  }
}
