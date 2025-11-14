import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommRevocationNotificationV2Message } from '../messages/DidCommRevocationNotificationV2Message'
import type { DidCommRevocationNotificationService } from '../services'

export class DidCommRevocationNotificationV2Handler implements DidCommMessageHandler {
  private revocationService: DidCommRevocationNotificationService
  public supportedMessages = [DidCommRevocationNotificationV2Message]

  public constructor(revocationService: DidCommRevocationNotificationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommRevocationNotificationV2Handler>) {
    await this.revocationService.v2ProcessRevocationNotification(messageContext)

    return undefined
  }
}
