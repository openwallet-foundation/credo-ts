import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { V2MediationRecipientService } from '../V2MediationRecipientService'

import { KeyListUpdateResponseMessage } from '../messages'

export class DidListUpdateResponseHandler implements Handler {
  public mediationRecipientService: V2MediationRecipientService
  public supportedMessages = [KeyListUpdateResponseMessage]

  public constructor(mediationRecipientService: V2MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<DidListUpdateResponseHandler>) {
    return await this.mediationRecipientService.processDidListUpdateResults(messageContext)
  }
}
