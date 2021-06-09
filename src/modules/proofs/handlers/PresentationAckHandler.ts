import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { PresentationAckMessage } from '../messages'
import { ProofService } from '../services'

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
