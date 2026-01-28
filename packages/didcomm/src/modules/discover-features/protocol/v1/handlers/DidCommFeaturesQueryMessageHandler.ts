import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../../../handlers'
import { DidCommOutboundMessageContext } from '../../../../../models'
import type { DidCommDiscoverFeaturesV1Service } from '../DidCommDiscoverFeaturesV1Service'
import { DidCommFeaturesQueryMessage } from '../messages'

export class DidCommFeaturesQueryMessageHandler implements DidCommMessageHandler {
  private discoverFeaturesService: DidCommDiscoverFeaturesV1Service
  public supportedMessages = [DidCommFeaturesQueryMessage]

  public constructor(discoverFeaturesService: DidCommDiscoverFeaturesV1Service) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommFeaturesQueryMessageHandler>) {
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
