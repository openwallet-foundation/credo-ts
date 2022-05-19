import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { ProofService } from '../../../ProofService'

import { V2PresentationAckMessage } from '../messages'

export class V2PresentationAckHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [V2PresentationAckMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V2PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
