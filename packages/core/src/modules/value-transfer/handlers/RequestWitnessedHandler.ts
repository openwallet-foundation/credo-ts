import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { ProblemReportMessage } from '../../problem-reports'
import { RequestWitnessedMessage } from '../messages/RequestWitnessedMessage'

export class RequestWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [RequestWitnessedMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<RequestWitnessedHandler>) {
    const { record, message } = await this.valueTransferGiverService.processRequestWitnessed(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToWitness(message)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToRequest(record)) {
      const { message } = await this.valueTransferGiverService.acceptRequest(record)
      return this.valueTransferService.sendMessageToWitness(message)
    }
  }
}
