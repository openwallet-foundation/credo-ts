import type { GossipService } from '../service'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { WitnessGossipInfoMessage, WitnessTableMessage, WitnessTableQueryMessage } from '../messages'

export class WitnessGossipMessageHandler implements Handler {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessGossipInfoMessage, WitnessTableQueryMessage, WitnessTableMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessGossipMessageHandler>) {
    await this.gossipService.receiveAndHandleMessage(messageContext.message)
  }
}
