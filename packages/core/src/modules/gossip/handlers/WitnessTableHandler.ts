import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { GossipService } from '../service'

import { WitnessTableMessage } from '../messages'

export class WitnessTableHandler implements Handler {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessTableMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableHandler>) {
    await this.gossipService.processWitnessTable(messageContext)
  }
}
