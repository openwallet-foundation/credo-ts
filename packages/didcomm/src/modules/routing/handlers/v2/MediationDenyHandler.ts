import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../handlers'
import { MediateDenyMessage } from '../../messages/v2'
import type { DidCommMediationRecipientService } from '../../services/DidCommMediationRecipientService'

export class MediationDenyHandler implements DidCommMessageHandler {
  private mediationRecipientService: DidCommMediationRecipientService
  public supportedMessages = [MediateDenyMessage]

  public constructor(mediationRecipientService: DidCommMediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<MediationDenyHandler>) {
    messageContext.assertReadyConnection()

    await this.mediationRecipientService.processMediationDenyV2(messageContext)

    return undefined
  }
}
