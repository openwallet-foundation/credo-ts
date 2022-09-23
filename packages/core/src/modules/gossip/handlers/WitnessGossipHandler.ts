import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { GossipService } from '../service'

import { WitnessGossipMessage } from '../messages'

export class WitnessGossipHandler implements Handler<typeof DIDCommV2Message> {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessGossipMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessGossipHandler>) {
    await this.gossipService.processWitnessGossipInfo(messageContext)
  }
}
