import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DiscoverFeaturesService } from '../services/DiscoverFeaturesService'

import { createOutboundMessage } from '../../../agent/helpers'
import { QueryMessage } from '../messages'

export class QueryMessageHandler implements Handler {
  private discoverFeaturesService: DiscoverFeaturesService
  public supportedMessages = [QueryMessage]

  public constructor(discoverFeaturesService: DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public handle(inboundMessage: HandlerInboundMessage<QueryMessageHandler>) {
    const connection = inboundMessage.assertReadyConnection()

    const discloseMessage = this.discoverFeaturesService.createDisclose(inboundMessage.message)

    return Promise.resolve(createOutboundMessage(connection, discloseMessage))
  }
}
