import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2ProofProtocol } from '../V2ProofProtocol'

import { V2PresentationAckMessage } from '../messages'

export class V2PresentationAckHandler implements MessageHandler {
  private proofProtocol: V2ProofProtocol
  public supportedMessages = [V2PresentationAckMessage]

  public constructor(proofProtocol: V2ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2PresentationAckHandler>) {
    await this.proofProtocol.processAck(messageContext)
  }
}
