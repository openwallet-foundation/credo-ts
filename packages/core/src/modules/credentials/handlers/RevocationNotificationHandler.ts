import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { RevocationService } from '../services'

import { RevocationNotificationMessageV1, RevocationNotificationMessageV2 } from '../messages'

export class RevocationNotificationV1Handler implements Handler {
  private revocationService: RevocationService
  public supportedMessages = [RevocationNotificationMessageV1]

  public constructor(revocationService: RevocationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<RevocationNotificationV1Handler>) {
    await this.revocationService.processRevocationNotificationV1(messageContext)
  }
}

export class RevocationNotificationV2Handler implements Handler {
  private revocationService: RevocationService
  public supportedMessages = [RevocationNotificationMessageV2]

  public constructor(revocationService: RevocationService) {
    this.revocationService = revocationService
  }

  public async handle(messageContext: HandlerInboundMessage<RevocationNotificationV2Handler>) {
    await this.revocationService.processRevocationNotificationV2(messageContext)
  }
}
