import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { GossipService } from '../service'

import { WitnessGossipMessage } from '../messages'

export class WitnessGossipHandler implements Handler {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessGossipMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessGossipHandler>) {
    await this.gossipService.processWitnessGossipInfo(messageContext)
  }
}
