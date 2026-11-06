import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommDiscoverFeaturesV2Service } from '../DidCommDiscoverFeaturesV2Service'

import { DidCommFeaturesDiscloseV2Message, DidCommFeaturesDisclosuresMessage } from '../messages'

export class DidCommFeaturesDisclosuresMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: DidCommDiscoverFeaturesV2Service
  public supportedMessages = [DidCommFeaturesDisclosuresMessage, DidCommFeaturesDiscloseV2Message]

  public constructor(discoverFeaturesService: DidCommDiscoverFeaturesV2Service) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommFeaturesDisclosuresMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)

    return undefined
  }
}
