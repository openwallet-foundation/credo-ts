import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { OutOfBandServiceV2 } from '../OutOfBandServiceV2'

import { createOutboundMessage } from '../../../agent/helpers'
import { HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [HandshakeReuseMessage]
  private outOfBandService: OutOfBandServiceV2

  public constructor(outOfBandService: OutOfBandServiceV2) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundMessageContext<HandshakeReuseMessage>) {
    const connectionRecord = messageContext.assertReadyConnection()
    const handshakeReuseAcceptedMessage = await this.outOfBandService.processHandshakeReuse(messageContext)

    return createOutboundMessage(connectionRecord, handshakeReuseAcceptedMessage)
  }
}
