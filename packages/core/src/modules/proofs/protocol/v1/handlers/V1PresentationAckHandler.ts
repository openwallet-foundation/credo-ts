import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V1ProofService } from '../V1ProofService'

import { V1PresentationAckMessage } from '../messages'

export class V1PresentationAckHandler implements MessageHandler {
  private proofService: V1ProofService
  public supportedMessages = [V1PresentationAckMessage]

  public constructor(proofService: V1ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V1PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
