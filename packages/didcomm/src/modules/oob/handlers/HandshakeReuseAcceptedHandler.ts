import type { DidCommMessageHandler } from '../../../handlers'
import type { InboundDidCommMessageContext } from '../../../models'
import type { DidCommOutOfBandService } from '../DidCommOutOfBandService'

import { HandshakeReuseAcceptedMessage } from '../messages/HandshakeReuseAcceptedMessage'

export class HandshakeReuseAcceptedHandler implements DidCommMessageHandler {
  public supportedMessages = [HandshakeReuseAcceptedMessage]
  private outOfBandService: DidCommOutOfBandService

  public constructor(outOfBandService: DidCommOutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundDidCommMessageContext<HandshakeReuseAcceptedMessage>) {
    messageContext.assertReadyConnection()

    await this.outOfBandService.processHandshakeReuseAccepted(messageContext)

    return undefined
  }
}
