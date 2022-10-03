import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { GossipService } from '../service'

import { WitnessTableQueryMessage } from '../messages'

export class WitnessTableQueryHandler implements Handler {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessTableQueryMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableQueryHandler>) {
    await this.gossipService.processWitnessTableQuery(messageContext)
  }
}
