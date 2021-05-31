import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MediationGrantMessage, RecipientService } from '..'

export class MediationGrantHandler implements Handler {
  private recipientService: RecipientService
  public supportedMessages = [MediationGrantMessage]

  public constructor(recipientService: RecipientService) {
    this.recipientService = recipientService
  }

  public async handle(messageContext: HandlerInboundMessage<MediationGrantHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    console.log("PUKE: filename: /src/modules/routing/handlers/MediationGrantHandler.ts, line: 16"); //PKDBG/Point;
    await this.recipientService.processMediationGrant(messageContext)
  }
}
