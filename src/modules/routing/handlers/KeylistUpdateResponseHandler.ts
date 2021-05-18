import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { KeylistUpdateResponseMessage } from '../messages'
import { RecipientService } from '../services'

export class KeylistUpdateResponseHandler implements Handler {
  public recipientService: RecipientService
  public supportedMessages = [KeylistUpdateResponseMessage]

  public constructor(recipientService: RecipientService) {
    this.recipientService = recipientService
  }

  public async handle(messageContext: HandlerInboundMessage<KeylistUpdateResponseHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    await this.recipientService.processKeylistUpdateResults(messageContext)
  }
}
