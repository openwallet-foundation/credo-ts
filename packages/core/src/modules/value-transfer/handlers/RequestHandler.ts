import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { ProblemReportMessage } from '../../problem-reports'
import { RequestMessage } from '../messages'

export class RequestHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [RequestMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<RequestHandler>) {
    const { record, message } = await this.valueTransferGiverService.processPaymentRequest(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToWitness(message, record)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToRequest()) {
      const { message } = await this.valueTransferGiverService.acceptRequest(record)
      return this.valueTransferService.sendMessageToWitness(message, record)
    }
  }
}
