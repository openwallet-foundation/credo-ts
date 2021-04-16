import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { ProofService } from '../services'
import { PresentationAckMessage } from '../messages'

export class PresentationAckHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [PresentationAckMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
