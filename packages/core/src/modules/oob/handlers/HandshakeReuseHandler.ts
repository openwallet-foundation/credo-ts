import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'

import { HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [HandshakeReuseMessage]

  public async handle(inboundMessage: HandlerInboundMessage<HandshakeReuseHandler>) {
    // const connection = inboundMessage.assertReadyConnection()
    // return createOutboundMessage(connection, new AgentMessage())
  }
}
