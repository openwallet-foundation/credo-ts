import type { GossipService } from '../services'
import type { Handler, HandlerInboundMessage } from '@aries-framework/core'

import { WitnessTableMessage, WitnessTableQueryMessage } from '@aries-framework/core'

import { WitnessGossipInfoMessage } from '../messages'

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
