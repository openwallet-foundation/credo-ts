import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { WitnessGossipMessage } from '../messages'

export class WitnessGossipHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [WitnessGossipMessage]

  public constructor(valueTransferWitnessService: ValueTransferWitnessService) {
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessGossipHandler>) {
    await this.valueTransferWitnessService.processWitnessGossipInfo(messageContext)
  }
}
