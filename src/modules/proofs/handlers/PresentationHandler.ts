import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { PresentationMessage } from '../messages'
import { ProofService } from '../services'

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
