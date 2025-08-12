import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V1DiscoverFeaturesService } from '../V1DiscoverFeaturesService'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V1QueryMessage } from '../messages'

export class V1QueryMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: V1DiscoverFeaturesService
  public supportedMessages = [V1QueryMessage]

  public constructor(discoverFeaturesService: V1DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<V1QueryMessageHandler>) {
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
