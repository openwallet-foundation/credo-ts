import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { GossipService } from '../service'

import { WitnessTableMessage } from '../messages'

export class WitnessTableHandler implements Handler<typeof DIDCommV2Message> {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessTableMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableHandler>) {
    await this.gossipService.processWitnessTable(messageContext)
  }
}
