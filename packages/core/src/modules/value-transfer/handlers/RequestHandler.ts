import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferResponseCoordinator } from '../ValueTransferResponseCoordinator'
import type { ValueTransferService } from '../services'
import type { ValueTransferGiverService } from '../services/ValueTransferGiverService'

import { TransactionState } from '@sicpa-dlab/value-transfer-protocol-ts'

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
    const { record } = await this.valueTransferGiverService.processPaymentRequest(messageContext)
    if (!record) return

    if (
      (record.state === TransactionState.RequestReceived &&
        this.valueTransferResponseCoordinator.shouldAutoRespondToRequest()) ||
      (record.state === TransactionState.RequestForOfferReceived &&
        this.valueTransferResponseCoordinator.shouldAutoRespondToOfferedRequest())
    ) {
      await this.valueTransferGiverService.acceptRequest(record)
    }
  }
}
