import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofService } from '../services'

import { PresentationMessage } from '../messages'

export class PresentationHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [PresentationMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationHandler>) {
    await this.proofService.processPresentation(messageContext)
  }
}
