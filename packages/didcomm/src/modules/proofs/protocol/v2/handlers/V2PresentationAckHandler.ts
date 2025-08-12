import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { ProofProtocol } from '../../ProofProtocol'

import { V2PresentationAckMessage } from '../messages'

export class V2PresentationAckHandler implements DidCommMessageHandler {
  private proofProtocol: ProofProtocol
  public supportedMessages = [V2PresentationAckMessage]

  public constructor(proofProtocol: ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<V2PresentationAckHandler>) {
    await this.proofProtocol.processAck(messageContext)

    return undefined
  }
}
