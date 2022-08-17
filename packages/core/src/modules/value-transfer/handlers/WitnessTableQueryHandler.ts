import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { WitnessTableQueryMessage } from '../messages'

export class WitnessTableQueryHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [WitnessTableQueryMessage]

  public constructor(valueTransferService: ValueTransferWitnessService) {
    this.valueTransferWitnessService = valueTransferService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableQueryHandler>) {
    await this.valueTransferWitnessService.processWitnessTableQuery(messageContext)
  }
}
