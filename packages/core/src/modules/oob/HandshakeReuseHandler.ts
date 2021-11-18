import type { Handler, HandlerInboundMessage } from '../../agent/Handler'

import { AgentMessage } from '../../agent/AgentMessage'
import { createOutboundMessage } from '../../agent/helpers'

import { HandshakeReuseMessage } from './HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [HandshakeReuseMessage]

  public async handle(inboundMessage: HandlerInboundMessage<HandshakeReuseHandler>) {
    // const connection = inboundMessage.assertReadyConnection()
    // return createOutboundMessage(connection, new AgentMessage())
  }
}
