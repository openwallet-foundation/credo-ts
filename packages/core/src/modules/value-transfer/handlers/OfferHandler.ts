import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGetterService } from '../services/ValueTransferGetterService'

import { OfferMessage } from '../messages'

export class OfferHandler implements Handler {
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
    const { record } = await this.valueTransferGetterService.processOffer(messageContext)
    if (!record) return

    if (this.valueTransferResponseCoordinator.shouldAutoRespondToOffer()) {
      await this.valueTransferGetterService.acceptOffer(record.id)
    }
  }
}
