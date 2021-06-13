import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofService } from '../services'

import { ProposePresentationMessage } from '../messages'

export class ProposePresentationHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [ProposePresentationMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    await this.proofService.processProposal(messageContext)
  }
}
