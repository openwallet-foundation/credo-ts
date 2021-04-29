import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationGrantMessage, MeditationRecipientService } from '..'

export class MediationGrantHandler implements Handler {
  private routingService: MeditationRecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(routingService: MediationService) {
    this.routingService = routingService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    this.routingService.processMediationGrant(messageContext)
  }
}
