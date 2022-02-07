import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1LegacyProofService } from '../V1LegacyProofService'

import { V1PresentationAckMessage } from '../messages'
import { V1ProofService } from '../V1ProofService'

export class V1PresentationAckHandler implements Handler {
  private proofService: V1ProofService
  public supportedMessages = [V1PresentationAckMessage]

  public constructor(proofService: V1ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<V1PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
