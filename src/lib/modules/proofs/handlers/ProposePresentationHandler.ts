import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { ProposePresentationMessage } from '../messages';
import { ProofService } from '../ProofService';

export class ProposePresentationHandler implements Handler {
  private proofService: ProofService;
  public supportedMessages = [ProposePresentationMessage];

  public constructor(proofService: ProofService) {
    this.proofService = proofService;
  }

  public async handle(messageContext: HandlerInboundMessage<ProposePresentationHandler>) {
    await this.proofService.processProposal(messageContext);
  }
}
