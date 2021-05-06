import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { RequestMediationMessage, MediatorService } from '..'

export class MediationRequestHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [RequestMediationMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationRequestHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    await this.mediatorService.processMediationRequest(messageContext)
  }
}
