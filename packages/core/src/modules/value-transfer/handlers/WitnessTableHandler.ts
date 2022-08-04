import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { WitnessTableMessage } from '../messages'

export class WitnessTableHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [WitnessTableMessage]

  public constructor(valueTransferWitnessService: ValueTransferWitnessService) {
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableHandler>) {
    await this.valueTransferWitnessService.processWitnessTable(messageContext)
  }
}
