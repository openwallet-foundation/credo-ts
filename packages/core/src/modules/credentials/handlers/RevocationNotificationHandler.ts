import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { RevocationService } from '../services'

import { RevocationNotificationMessage } from '../messages'

export class RevocationNotificationHandler implements Handler {
  private revocationService: RevocationService
  public supportedMessages = [RevocationNotificationMessage]

  public constructor(revocationService: RevocationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<RevocationNotificationHandler>) {
    await this.revocationService.processRevocationNotification(messageContext)
  }
}
