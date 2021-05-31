import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationRequestMessage, MediatorService } from '..'

export class MediationRequestHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [MediationRequestMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    return await this.mediatorService.processMediationRequest(messageContext)
  }
}
