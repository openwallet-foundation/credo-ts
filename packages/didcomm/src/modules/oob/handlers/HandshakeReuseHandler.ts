import type { DidCommMessageHandler } from '../../../handlers'
import type { InboundDidCommMessageContext } from '../../../models'
import type { DidCommOutOfBandService } from '../DidCommOutOfBandService'

import { OutboundDidCommMessageContext } from '../../../models'
import { HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements DidCommMessageHandler {
  public supportedMessages = [HandshakeReuseMessage]
  private outOfBandService: DidCommOutOfBandService

  public constructor(outOfBandService: DidCommOutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: InboundDidCommMessageContext<HandshakeReuseMessage>) {
    const connectionRecord = messageContext.assertReadyConnection()
    const handshakeReuseAcceptedMessage = await this.outOfBandService.processHandshakeReuse(messageContext)

    return new OutboundDidCommMessageContext(handshakeReuseAcceptedMessage, {
      agentContext: messageContext.agentContext,
      connection: connectionRecord,
    })
  }
}
