import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { OutOfBandServiceV2 } from '../OutOfBandServiceV2'

import { HandshakeReuseAcceptedMessage } from '../messages/HandshakeReuseAcceptedMessage'

export class HandshakeReuseAcceptedHandler implements Handler {
  public supportedMessages = [HandshakeReuseAcceptedMessage]
  private outOfBandService: OutOfBandServiceV2

  public constructor(outOfBandService: OutOfBandServiceV2) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundMessageContext<HandshakeReuseAcceptedMessage>) {
    messageContext.assertReadyConnection()

    await this.outOfBandService.processHandshakeReuseAccepted(messageContext)
  }
}
