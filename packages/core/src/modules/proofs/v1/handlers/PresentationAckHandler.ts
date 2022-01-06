import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { V1LegacyProofService } from '../V1LegacyProofService'

import { PresentationAckMessage } from '../messages'

export class PresentationAckHandler implements Handler {
  private proofService: V1LegacyProofService
  public supportedMessages = [PresentationAckMessage]

  public constructor(proofService: V1LegacyProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
