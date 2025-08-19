import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommDiscoverFeaturesService } from '../V2DidCommDiscoverFeaturesService'

import { V2DisclosuresMessage } from '../messages'

export class V2DisclosuresMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: V2DidCommDiscoverFeaturesService
  public supportedMessages = [V2DisclosuresMessage]

  public constructor(discoverFeaturesService: V2DidCommDiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<V2DisclosuresMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)

    return undefined
  }
}
