import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { RevocationService } from '../../../services'

import { V2RevocationNotificationMessage } from '../messages/V2RevocationNotificationMessage'

export class V2RevocationNotificationHandler implements Handler {
  private revocationService: RevocationService
  public supportedMessages = [V2RevocationNotificationMessage]

  public constructor(revocationService: RevocationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<V2RevocationNotificationHandler>) {
    await this.revocationService.v2ProcessRevocationNotification(messageContext)
  }
}
