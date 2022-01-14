import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../services'

import { AriesFrameworkError } from '../../../error'
import { KeylistUpdateResponseMessage } from '../messages'

export class KeylistUpdateResponseHandler implements Handler {
  public mediationRecipientService: MediationRecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(mediationRecipientService: MediationRecipientService) {
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection not found (verkey=${messageContext.recipientVerkey ?? 'unknown'}`)
    }
    return await this.mediationRecipientService.processKeylistUpdateResults(messageContext)
  }
}
