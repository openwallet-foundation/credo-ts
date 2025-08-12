import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V1DidCommDiscoverFeaturesService } from '../V1DidCommDiscoverFeaturesService'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V1QueryMessage } from '../messages'

export class V1QueryMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: V1DidCommDiscoverFeaturesService
  public supportedMessages = [V1QueryMessage]

  public constructor(discoverFeaturesService: V1DidCommDiscoverFeaturesService) {
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
