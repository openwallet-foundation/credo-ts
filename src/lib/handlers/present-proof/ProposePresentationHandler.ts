import { Handler, HandlerInboundMessage } from '../Handler';

import { ProposePresentationMessage, ProofService } from '../../protocols/present-proof';

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
