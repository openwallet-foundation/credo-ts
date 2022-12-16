import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { ProofService } from '../../../ProofService'

import { V2PresentationAckMessage } from '../messages'

export class V2PresentationAckHandler implements MessageHandler {
  private proofService: ProofService
  public supportedMessages = [V2PresentationAckMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
