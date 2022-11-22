import type { Handler } from '../../../agent/Handler'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { OutOfBandService } from '../OutOfBandService'

import { OutboundMessageContext } from '../../../agent/models'
import { HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [HandshakeReuseMessage]
  private outOfBandService: OutOfBandService

  public constructor(outOfBandService: OutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundMessageContext<HandshakeReuseMessage>) {
    const connectionRecord = messageContext.assertReadyConnection()
    const handshakeReuseAcceptedMessage = await this.outOfBandService.processHandshakeReuse(messageContext)

    return new OutboundMessageContext(handshakeReuseAcceptedMessage, {
      agentContext: messageContext.agentContext,
      connection: connectionRecord,
    })
  }
}
