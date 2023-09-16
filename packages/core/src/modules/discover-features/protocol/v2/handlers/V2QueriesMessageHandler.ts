import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2DiscoverFeaturesService } from '../V2DiscoverFeaturesService'

import { getOutboundMessageContext } from '../../../../../agent/getOutboundMessageContext'
import { V2QueriesMessage } from '../messages'
import { V2QueriesDidCommV2Message } from '../messages/V2QueriesDidCommV2Message'

export class V2QueriesMessageHandler implements MessageHandler {
  private discoverFeaturesService: V2DiscoverFeaturesService
  public supportedMessages = [V2QueriesMessage, V2QueriesDidCommV2Message]

  public constructor(discoverFeaturesService: V2DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<V2QueriesMessageHandler>) {
    const connectionRecord = inboundMessage.assertReadyConnection()

    const discloseMessage = await this.discoverFeaturesService.processQuery(inboundMessage)

    if (discloseMessage) {
      return getOutboundMessageContext(inboundMessage.agentContext, {
        message: discloseMessage.message,
        connectionRecord,
      })
    }
  }
}
