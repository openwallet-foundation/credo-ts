import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ProofService } from '../services'

import { RequestPresentationMessage } from '../messages'

export class RequestPresentationHandler implements Handler {
  private proofService: ProofService
  public supportedMessages = [RequestPresentationMessage]

  public constructor(proofService: ProofService) {
    this.proofService = proofService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestPresentationHandler>) {
    await this.proofService.processRequest(messageContext)
  }
}
