import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { MediationRecipientService } from '../services'

import { KeylistUpdateResponseMessageV2 } from '../messages'

export class KeylistUpdateResponseHandler implements Handler<typeof DIDCommV2Message> {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessageV2]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    return await this.mediationRecipientService.processKeylistUpdateResults(messageContext)
  }
}
