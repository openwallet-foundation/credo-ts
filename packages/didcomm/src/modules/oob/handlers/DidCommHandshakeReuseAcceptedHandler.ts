import type { DidCommMessageHandler } from '../../../handlers'
import type { DidCommInboundMessageContext } from '../../../models'
import type { DidCommOutOfBandService } from '../DidCommOutOfBandService'

import { DidCommHandshakeReuseAcceptedMessage } from '../messages/DidCommHandshakeReuseAcceptedMessage'

export class DidCommHandshakeReuseAcceptedHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommHandshakeReuseAcceptedMessage]
  private outOfBandService: DidCommOutOfBandService

  public constructor(outOfBandService: DidCommOutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommHandshakeReuseAcceptedMessage>) {
    messageContext.assertReadyConnection()

    await this.outOfBandService.processHandshakeReuseAccepted(messageContext)

    return undefined
  }
}
