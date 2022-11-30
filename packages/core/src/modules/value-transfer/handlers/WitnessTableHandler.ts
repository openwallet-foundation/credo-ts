import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { ValueTransferService } from '../services'

import { WitnessTableMessage } from '../../gossip'

export class WitnessTableHandler implements Handler {
  private valueTransferService: ValueTransferService

  public readonly supportedMessages = [WitnessTableMessage]

  public constructor(gossipService: ValueTransferService) {
    this.valueTransferService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableHandler>) {
    await this.valueTransferService.processWitnessTable(messageContext)
  }
}
