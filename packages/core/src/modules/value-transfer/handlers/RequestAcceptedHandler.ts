import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { RequestAcceptedMessage } from '../messages'

export class RequestAcceptedHandler implements Handler {
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestAcceptedMessage]

  public constructor(valueTransferWitnessService: ValueTransferWitnessService) {
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestAcceptedHandler>) {
    await this.valueTransferWitnessService.processRequestAcceptance(messageContext)
  }
}
