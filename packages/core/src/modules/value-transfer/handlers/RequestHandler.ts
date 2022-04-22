import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'

import { RequestMessage } from '../messages'
import { ValueTransferService } from '../services'

export class RequestHandler implements Handler {
  private valueTransferService: ValueTransferService
  public supportedMessages = [RequestMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestMessage>) {
    await this.valueTransferService.processRequest(messageContext)
  }
}
