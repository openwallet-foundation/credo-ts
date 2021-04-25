import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationService, KeylistUpdateMessage } from '..'
import { createOutboundMessage } from '../../../agent/helpers'

export class KeylistUpdateHandler implements Handler {
  private mediationService: MediationService
  public supportedMessages = [KeylistUpdateMessage]

  public constructor(mediationService: MediationService) {}

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const message = this.routingService.updateRoutes(messageContext)
    return createOutboundMessage(messageContext.connection, message)
  }
}
