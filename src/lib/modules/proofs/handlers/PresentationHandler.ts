import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { PresentationMessage } from '../messages';
import { ProofService } from '../ProofService';

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
