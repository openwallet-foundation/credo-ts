import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'

import { V2DisclosuresMessage } from '../messages'

export class V2DisclosuresMessageHandler implements Handler {
  public supportedMessages = [V2DisclosuresMessage]

  public async handle(inboundMessage: HandlerInboundMessage<V2DisclosuresMessageHandler>) {
    // We don't really need to do anything with this at the moment
    // The result can be hooked into through the generic message processed event
    inboundMessage.assertReadyConnection()
  }
}
