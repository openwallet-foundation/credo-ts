import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { ProblemReportMessage } from '../../problem-reports'
import { ValueTransferRole } from '../ValueTransferRole'
import { OfferWitnessedMessage } from '../messages/OfferWitnessedMessage'

export class OfferWitnessedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [OfferWitnessedMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<OfferWitnessedHandler>) {
    const { record, message } = await this.valueTransferGetterService.processOfferWitnessed(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToWitness(message, record?.role ?? ValueTransferRole.Getter)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToOffer()) {
      const { message } = await this.valueTransferGetterService.acceptOffer(record)
      return this.valueTransferService.sendMessageToWitness(message, record.role)
    }
  }
}
