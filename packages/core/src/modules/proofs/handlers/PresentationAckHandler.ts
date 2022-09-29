import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { ProofService } from '../services'

import { PresentationAckMessage } from '../messages'

export class PresentationAckHandler implements Handler<typeof DIDCommV1Message> {
  private proofService: ProofService
  public supportedMessages = [PresentationAckMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<PresentationAckHandler>) {
    await this.proofService.processAck(messageContext)
  }
}
