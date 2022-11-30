import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services'

import { V2KeyListUpdateResponseMessage } from '../messages'

export class DidListUpdateResponseHandler implements Handler {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [V2KeyListUpdateResponseMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<DidListUpdateResponseHandler>) {
    return await this.mediationRecipientService.processDidListUpdateResults(messageContext)
  }
}
