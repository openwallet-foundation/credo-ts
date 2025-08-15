import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommProofProtocol } from '../../DidCommProofProtocol'

import { V2PresentationAckMessage } from '../messages'

export class V2PresentationAckHandler implements DidCommMessageHandler {
  private proofProtocol: DidCommProofProtocol
  public supportedMessages = [V2PresentationAckMessage]

  public constructor(proofProtocol: DidCommProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2PresentationAckHandler>) {
    await this.proofProtocol.processAck(messageContext)

    return undefined
  }
}
