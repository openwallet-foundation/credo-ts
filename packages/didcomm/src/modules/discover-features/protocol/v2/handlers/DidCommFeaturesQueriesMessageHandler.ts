import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { DidCommDiscoverFeaturesV2Service } from '../DidCommDiscoverFeaturesV2Service'

import { DidCommOutboundMessageContext } from '../../../../../models'
import { DidCommFeaturesQueriesMessage } from '../messages'

export class DidCommFeaturesQueriesMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: DidCommDiscoverFeaturesV2Service
  public supportedMessages = [DidCommFeaturesQueriesMessage]

  public constructor(discoverFeaturesService: DidCommDiscoverFeaturesV2Service) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommFeaturesQueriesMessageHandler>) {
    const connection = inboundMessage.assertReadyConnection()

    const discloseMessage = await this.discoverFeaturesService.processQuery(inboundMessage)

    if (discloseMessage) {
      return new DidCommOutboundMessageContext(discloseMessage.message, {
        agentContext: inboundMessage.agentContext,
        connection,
      })
    }
  }
}
