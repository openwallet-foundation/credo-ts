import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'
import type { DiscoverFeaturesService } from '../services/DiscoverFeaturesService'

import { createOutboundMessage } from '../../../agent/helpers'
import { QueryMessage } from '../messages'

export class QueryMessageHandler implements Handler<typeof DIDCommV1Message> {
  private discoverFeaturesService: DiscoverFeaturesService
  public supportedMessages = [QueryMessage]

  public constructor(discoverFeaturesService: DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: HandlerInboundMessage<QueryMessageHandler>) {
    const connection = inboundMessage.assertReadyConnection()

    const discloseMessage = await this.discoverFeaturesService.createDisclose(inboundMessage.message)

    return createOutboundMessage(connection, discloseMessage)
  }
}
