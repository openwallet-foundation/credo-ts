import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { RequestAcceptedWitnessedMessage } from '../messages'

export class RequestAcceptedWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferGetterService: ValueTransferGetterService

  public readonly supportedMessages = [RequestAcceptedWitnessedMessage]

  public constructor(valueTransferGetterService: ValueTransferGetterService) {
    this.valueTransferGetterService = valueTransferGetterService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestAcceptedWitnessedHandler>) {
    await this.valueTransferGetterService.processRequestAcceptanceWitnessed(messageContext)
  }
}
