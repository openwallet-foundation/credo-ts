import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { DidCommRevocationNotificationV1Message } from '../messages/DidCommRevocationNotificationV1Message'
import type { DidCommRevocationNotificationService } from '../services'

export class DidCommRevocationNotificationV1Handler implements DidCommMessageHandler {
  private revocationService: DidCommRevocationNotificationService
  public supportedMessages = [DidCommRevocationNotificationV1Message]

  public constructor(revocationService: DidCommRevocationNotificationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommRevocationNotificationV1Handler>) {
    await this.revocationService.v1ProcessRevocationNotification(messageContext)

    return undefined
  }
}
