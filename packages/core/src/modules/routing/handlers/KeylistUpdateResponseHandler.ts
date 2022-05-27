import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { MediationRecipientService } from '../services'

import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements Handler<typeof DIDCommV1Message> {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipient} not found!`)
    }
    return await this.mediationRecipientService.processKeylistUpdateResults(messageContext)
  }
}
