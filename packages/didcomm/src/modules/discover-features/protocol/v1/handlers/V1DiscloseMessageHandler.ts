import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V1DidCommDiscoverFeaturesService } from '../V1DidCommDiscoverFeaturesService'

import { V1DiscloseMessage } from '../messages'

export class V1DiscloseMessageHandler implements DidCommMessageHandler {
  public supportedMessages = [V1DiscloseMessage]
  private discoverFeaturesService: V1DidCommDiscoverFeaturesService

  public constructor(discoverFeaturesService: V1DidCommDiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<V1DiscloseMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)

    return undefined
  }
}
