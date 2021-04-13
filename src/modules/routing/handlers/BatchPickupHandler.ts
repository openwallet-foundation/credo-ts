import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { MessagePickupService } from '../services'
import { BatchPickupMessage } from '../messages'

export class BatchPickupHandler implements Handler {
  private messagePickupService: MessagePickupService
  public supportedMessages = [BatchPickupMessage]

  public constructor(messagePickupService: MessagePickupService) {
    this.messagePickupService = messagePickupService
  }

  public async handle(messageContext: HandlerInboundMessage<BatchPickupHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    return this.messagePickupService.batch(messageContext.connection)
  }
}
