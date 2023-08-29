import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V3ProofProtocol } from '../V3ProofProtocol'

import { V3PresentationAckMessage } from '../messages'

export class V3PresentationAckHandler implements MessageHandler {
  private proofProtocol: V3ProofProtocol
  public supportedMessages = [V3PresentationAckMessage]

  public constructor(proofProtocol: V3ProofProtocol) {
    this.proofProtocol = proofProtocol
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V3PresentationAckHandler>) {
    await this.proofProtocol.processAck(messageContext)
  }
}
