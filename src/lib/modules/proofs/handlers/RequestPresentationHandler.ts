import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { RequestPresentationMessage } from '../messages';
import { ProofService } from '../ProofService';

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService;
  public supportedMessages = [RequestPresentationMessage];

  public constructor(proofService: ProofService) {
    this.proofService = proofService;
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    await this.proofService.processRequest(messageContext);
  }
}
