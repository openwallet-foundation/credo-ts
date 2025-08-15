import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import type { V2DidCommDiscoverFeaturesService } from '../V2DidCommDiscoverFeaturesService'

import { OutboundDidCommMessageContext } from '../../../../../models'
import { V2QueriesMessage } from '../messages'

export class V2QueriesMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: V2DidCommDiscoverFeaturesService
  public supportedMessages = [V2QueriesMessage]

  public constructor(discoverFeaturesService: V2DidCommDiscoverFeaturesService) {
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
