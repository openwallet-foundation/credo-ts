import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services/ValueTransferService'

import { WitnessTableMessage } from '../messages'

export class WitnessTableHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService

  public readonly supportedMessages = [WitnessTableMessage]

  public constructor(valueTransferService: ValueTransferService) {
    this.valueTransferService = valueTransferService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableHandler>) {
    await this.valueTransferService.processWitnessTable(messageContext)
  }
}
