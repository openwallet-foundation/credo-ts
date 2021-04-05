import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ProposePresentationMessage } from '../messages'
import { ProofService } from '../services'

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
