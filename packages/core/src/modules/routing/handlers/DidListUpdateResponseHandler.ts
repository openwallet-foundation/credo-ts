import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services'

import { DidListUpdateResponseMessage } from '../messages'

export class DidListUpdateResponseHandler implements Handler {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [DidListUpdateResponseMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<DidListUpdateResponseHandler>) {
    return await this.mediationRecipientService.processDidListUpdateResults(messageContext)
  }
}
