import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { RevocationNotificationService } from '../services'

import { V1RevocationNotificationMessage } from '../messages/V1RevocationNotificationMessage'

export class V1RevocationNotificationHandler implements Handler {
  private revocationService: RevocationNotificationService
  public supportedMessages = [V1RevocationNotificationMessage]

  public constructor(revocationService: RevocationNotificationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<V1RevocationNotificationHandler>) {
    await this.revocationService.v1ProcessRevocationNotification(messageContext)
  }
}
