import type { DidCommMessageHandler } from '../../../handlers'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommOutboundMessageContext } from '../../../models'
import type { DidCommOutOfBandService } from '../DidCommOutOfBandService'
import { DidCommHandshakeReuseMessage } from '../messages/DidCommHandshakeReuseMessage'

export class DidCommHandshakeReuseHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommHandshakeReuseMessage]
  private outOfBandService: DidCommOutOfBandService

  public constructor(outOfBandService: DidCommOutOfBandService) {
    this.outOfBandService = outOfBandService
  }

  public async handle(messageContext: DidCommInboundMessageContext<DidCommHandshakeReuseMessage>) {
    const connectionRecord = messageContext.assertReadyConnection()
    const handshakeReuseAcceptedMessage = await this.outOfBandService.processHandshakeReuse(messageContext)

    return new DidCommOutboundMessageContext(handshakeReuseAcceptedMessage, {
      agentContext: messageContext.agentContext,
      connection: connectionRecord,
    })
  }
}
