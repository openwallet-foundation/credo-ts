import type { DidCommMessageHandler } from '../../../handlers'
import type { InboundDidCommMessageContext } from '../../../models'
import type { OutOfBandService } from '../OutOfBandService'

import { HandshakeReuseAcceptedMessage } from '../messages/HandshakeReuseAcceptedMessage'

export class HandshakeReuseAcceptedHandler implements DidCommMessageHandler {
  public supportedMessages = [HandshakeReuseAcceptedMessage]
  private outOfBandService: OutOfBandService

  public constructor(outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundDidCommMessageContext<HandshakeReuseAcceptedMessage>) {
    messageContext.assertReadyConnection()

    await this.outOfBandService.processHandshakeReuseAccepted(messageContext)

    return undefined
  }
}
