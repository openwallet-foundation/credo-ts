import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { OfferMessage, ProblemReportMessage } from '../messages'

export class OfferHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public readonly supportedMessages = [OfferMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferGetterService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferWitnessService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<OfferHandler>) {
    const { record, message } = await this.valueTransferGetterService.processOffer(messageContext)
    if (!record || message.type === ProblemReportMessage.type) {
      return this.valueTransferService.sendMessageToWitness(message, record)
    }

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToOffer()) {
      const { message } = await this.valueTransferGetterService.acceptOffer(record)
      return this.valueTransferService.sendMessageToWitness(message, record)
    }
  }
}
