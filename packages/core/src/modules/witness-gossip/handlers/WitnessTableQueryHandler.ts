import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { GossipService } from '../service'

import { WitnessTableQueryMessage } from '../messages'

export class WitnessTableQueryHandler implements Handler<typeof DIDCommV2Message> {
  private gossipService: GossipService

  public readonly supportedMessages = [WitnessTableQueryMessage]

  public constructor(gossipService: GossipService) {
    this.gossipService = gossipService
  }

  public async handle(messageContext: HandlerInboundMessage<WitnessTableQueryHandler>) {
    await this.gossipService.processWitnessTableQuery(messageContext)
  }
}
