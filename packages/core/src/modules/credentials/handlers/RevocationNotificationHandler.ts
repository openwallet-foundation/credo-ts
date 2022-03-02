import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { RevocationService } from '../services'

import { V1RevocationNotificationMessage, V2RevocationNotificationMessage } from '../messages'

export class V1RevocationNotificationHandler implements Handler {
  private revocationService: RevocationService
  public supportedMessages = [V1RevocationNotificationMessage]

  public constructor(revocationService: RevocationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<V1RevocationNotificationHandler>) {
    await this.revocationService.v1ProcessRevocationNotification(messageContext)
  }
}

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
