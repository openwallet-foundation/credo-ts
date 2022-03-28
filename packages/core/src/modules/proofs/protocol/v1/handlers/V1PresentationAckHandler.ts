import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { ProofService } from '../../../ProofService'

import { V1PresentationAckMessage } from '../messages'

export class V1PresentationAckHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [V1PresentationAckMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V1PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
