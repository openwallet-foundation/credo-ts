import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DiscoverFeaturesService } from '../V2DiscoverFeaturesService'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V2QueriesMessage } from '../messages'

export class V2QueriesMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: V2DiscoverFeaturesService
  public supportedMessages = [V2QueriesMessage]

  public constructor(discoverFeaturesService: V2DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<V2QueriesMessageHandler>) {
    const connection = inboundMessage.assertReadyConnection()

    const discloseMessage = await this.discoverFeaturesService.processQuery(inboundMessage)

    if (discloseMessage) {
      return new OutboundDidCommMessageContext(discloseMessage.message, {
        agentContext: inboundMessage.agentContext,
        connection,
      })
    }
  }
}
