import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommDiscoverFeaturesV1Service } from '../DidCommDiscoverFeaturesV1Service'

import { DidCommFeaturesDiscloseMessage } from '../messages'

export class DidCommFeaturesDiscloseMessageHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommFeaturesDiscloseMessage]
  private discoverFeaturesService: DidCommDiscoverFeaturesV1Service

  public constructor(discoverFeaturesService: DidCommDiscoverFeaturesV1Service) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommFeaturesDiscloseMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)

    return undefined
  }
}
