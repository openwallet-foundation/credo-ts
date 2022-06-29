import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { ProblemReportMessage, RequestMessage } from '../messages'

export class RequestHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [RequestMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<RequestHandler>) {
    const { message } = await this.valueTransferWitnessService.processRequest(messageContext)
    if (message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToGetter(message)
    }
    return this.valueTransferService.sendMessageToGiver(message)
  }
}
