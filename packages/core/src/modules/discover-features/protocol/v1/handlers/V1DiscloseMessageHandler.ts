import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { V1DiscoverFeaturesService } from '../V1DiscoverFeaturesService'

import { V1DiscloseMessage } from '../messages'

export class V1DiscloseMessageHandler implements Handler {
  public supportedMessages = [V1DiscloseMessage]
  private discoverFeaturesService: V1DiscoverFeaturesService

  public constructor(discoverFeaturesService: V1DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: HandlerInboundMessage<V1DiscloseMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)
  }
}
