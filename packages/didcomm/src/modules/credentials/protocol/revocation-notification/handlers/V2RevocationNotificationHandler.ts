import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { RevocationNotificationService } from '../services'

import { V2RevocationNotificationMessage } from '../messages/V2RevocationNotificationMessage'

export class V2RevocationNotificationHandler implements DidCommMessageHandler {
  private revocationService: RevocationNotificationService
  public supportedMessages = [V2RevocationNotificationMessage]

  public constructor(revocationService: RevocationNotificationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2RevocationNotificationHandler>) {
    await this.revocationService.v2ProcessRevocationNotification(messageContext)

    return undefined
  }
}
