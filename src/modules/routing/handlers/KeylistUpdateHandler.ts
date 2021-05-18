import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediatorService, KeylistUpdateMessage } from '..'
import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'

export class KeylistUpdateHandler implements Handler {
  private mediatorService: MediatorService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediatorService: MediatorService) {
    this.mediatorService = mediatorService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    await this.mediatorService.processKeylistUpdateRequest(messageContext)
  }
}
