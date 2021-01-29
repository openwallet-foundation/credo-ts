import { Handler, HandlerInboundMessage } from '../Handler';

import { PresentationMessage, ProofService } from '../../protocols/present-proof';

export class PresentationHandler implements Handler {
  private proofService: ProofService;
  public supportedMessages = [PresentationMessage];

  public constructor(proofService: ProofService) {
    this.proofService = proofService;
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationHandler>) {
    await this.proofService.processPresentation(messageContext);
  }
}
