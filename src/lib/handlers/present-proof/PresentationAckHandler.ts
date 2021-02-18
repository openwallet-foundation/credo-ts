import { Handler, HandlerInboundMessage } from '../Handler';

import { PresentationAckMessage, ProofService } from '../../protocols/present-proof';

export class PresentationAckHandler implements Handler {
  private proofService: ProofService;
  public supportedMessages = [PresentationAckMessage];

  public constructor(proofService: ProofService) {
    this.proofService = proofService;
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationAckHandler>) {
    await this.proofService.processAck(messageContext);
  }
}
