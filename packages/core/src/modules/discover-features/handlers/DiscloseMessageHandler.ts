import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV1Message } from '../../../agent/didcomm'

import { DiscloseMessage } from '../messages'

export class DiscloseMessageHandler implements Handler<typeof DIDCommV1Message> {
  public supportedMessages = [DiscloseMessage]

  public async handle(inboundMessage: HandlerInboundMessage<DiscloseMessageHandler>) {
    // We don't really need to do anything with this at the moment
    // The result can be hooked into through the generic message processed event
    inboundMessage.assertReadyConnection()
  }
}
